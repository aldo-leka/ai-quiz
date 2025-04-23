import supabase from './supabase';
import { GameSession, Player, PlayerAnswer, QuestionResult } from 'shared';
import crypto from 'crypto';

/**
 * Save a game session to the database
 */
export async function saveGameSession(session: GameSession): Promise<string | null> {
  try {
    // Start a Supabase transaction
    const { data: transaction, error: transactionError } = await supabase.rpc('begin_transaction');
    
    if (transactionError) {
      console.error('Error starting transaction:', transactionError);
      return null;
    }
    
    // For host IDs, we need to check if it's a valid UUID (user ID) or a socket ID
    const socketHostId = session.hostId;
    
    // Find the host player to get their properties
    const hostPlayer = session.players.find(p => p.isHost);
    
    // Step 1: Save or update the game record
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .upsert({
        id: session.id,
        code: session.code,
        // Use the hostUserId from the session if available
        host_id: session.hostUserId || (hostPlayer?.userId ? hostPlayer.userId : null),
        socket_host_id: socketHostId, // Store socket ID for connection management
        status: session.status,
        quiz_id: session.currentQuizId,
        current_question_index: session.currentQuestionIndex,
        started_at: session.startedAt,
        ended_at: session.endedAt,
        last_activity_at: session.lastActivityAt || new Date().toISOString(),
        host_disconnected_at: session.hostDisconnectedAt ? new Date(session.hostDisconnectedAt).toISOString() : null
      })
      .select()
      .single();
    
    if (gameError) {
      console.error('Error saving game session:', gameError);
      await supabase.rpc('rollback_transaction');
      return null;
    }
    
    // Step 2: Save or update all players
    for (const player of session.players) {
      // For players, prefer to use their userId if available (for registered users)
      // Otherwise generate a UUID for the player if their ID is a socket ID (not a valid UUID)
      let playerId = player.userId || player.id;
      
      try {
        // Check if the ID is a valid UUID
        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playerId);
        if (!isValidUuid) {
          // If not a valid UUID, generate a new one but keep the socket ID separately
          playerId = crypto.randomUUID();
          console.log(`Generated new UUID ${playerId} for player with socket ID ${player.id}`);
        }
      } catch (error) {
        // If there's any error, generate a UUID to be safe
        playerId = crypto.randomUUID();
        console.log(`Generated fallback UUID ${playerId} for player`);
      }
      
      // For hosts, check if we should associate them with a user account
      const dbUserId = player.isHost ? session.hostUserId : player.userId;
      
      const { error: playerError } = await supabase
        .from('players')
        .upsert({
          id: playerId,
          name: player.name,
          avatar: player.avatar,
          score: player.score,
          is_connected: player.isConnected,
          is_host: player.isHost,
          game_id: session.id,
          socket_id: player.id, // Store the original socket ID here
          user_id: dbUserId // Link to user account if available
        }, { 
          onConflict: 'game_id,name' // Specify the fields that form the unique constraint
        });
      
      if (playerError) {
        console.error(`Error saving player ${player.id}:`, playerError);
        await supabase.rpc('rollback_transaction');
        return null;
      }
    }
    
    // Step 3: Save all player answers if they exist
    if (session.playerAnswers && session.playerAnswers.length > 0) {
      for (const answer of session.playerAnswers) {
        // Need to find the player's database ID that matches this socket ID
        // We need to look up the player by their socket ID
        const { data: playerData, error: playerLookupError } = await supabase
          .from('players')
          .select('id')
          .eq('socket_id', answer.playerId)
          .eq('game_id', session.id)
          .single();
        
        if (playerLookupError) {
          console.error(`Cannot find player with socket ID ${answer.playerId} for answer '${answer.answer}':`, playerLookupError);
          continue; // Skip this answer rather than failing the whole transaction
        }
        
        const dbPlayerId = playerData?.id;
        
        if (!dbPlayerId) {
          console.error(`No matching player found with socket ID ${answer.playerId}`);
          continue;
        }
        
        const { error: answerError } = await supabase
          .from('answers')
          .upsert({
            player_id: dbPlayerId, // Use the database player ID, not the socket ID
            question_id: answer.questionId,
            game_id: session.id,
            answer: Array.isArray(answer.answer) ? answer.answer : [answer.answer],
            is_correct: answer.isCorrect,
            time_to_answer: answer.timeToAnswer
          }, { onConflict: 'player_id, question_id, game_id' });
        
        if (answerError) {
          console.error(`Error saving answer from player ${answer.playerId}:`, answerError);
          await supabase.rpc('rollback_transaction');
          return null;
        }
      }
    }
    
    // Commit the transaction
    await supabase.rpc('commit_transaction');
    
    return session.id;
  } catch (error) {
    console.error('Error in saveGameSession:', error);
    await supabase.rpc('rollback_transaction');
    return null;
  }
}

/**
 * Get a game session by code
 */
export async function getGameSessionByCode(code: string): Promise<GameSession | null> {
  try {
    // Step 1: Get the game record
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('code', code)
      .single();
    
    if (gameError) {
      console.error('Error fetching game session:', gameError);
      return null;
    }
    
    // Step 2: Get all players in this game
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameData.id);
    
    if (playersError) {
      console.error('Error fetching players:', playersError);
      return null;
    }
    
    // Step 3: Get all answers for this game
    const { data: answersData, error: answersError } = await supabase
      .from('answers')
      .select('*')
      .eq('game_id', gameData.id);
    
    if (answersError) {
      console.error('Error fetching answers:', answersError);
      return null;
    }
    
    // Transform data into the GameSession format
    const players: Player[] = playersData.map(p => ({
      id: p.socket_id || p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      isConnected: p.is_connected,
      isHost: p.is_host
    }));
    
    const playerAnswers: PlayerAnswer[] = answersData.map(a => ({
      playerId: a.player_id,
      questionId: a.question_id,
      answer: a.answer.length === 1 ? a.answer[0] : a.answer,
      isCorrect: a.is_correct,
      timeToAnswer: a.time_to_answer
    }));
    
    // Create the game session object
    const gameSession: GameSession = {
      id: gameData.id,
      code: gameData.code,
      hostId: gameData.socket_host_id || gameData.host_id, // Prefer socket_host_id
      hostUserId: gameData.host_id, // Store the host's user ID if available
      hostDisconnectedAt: gameData.host_disconnected_at, // Include host disconnect timestamp
      status: gameData.status,
      players,
      currentQuizId: gameData.quiz_id,
      currentQuestionIndex: gameData.current_question_index,
      startedAt: gameData.started_at,
      endedAt: gameData.ended_at,
      playerAnswers,
      createdAt: gameData.created_at,
      lastActivityAt: gameData.last_activity_at || gameData.created_at // Use created_at as fallback
    };
    
    return gameSession;
  } catch (error) {
    console.error('Error in getGameSessionByCode:', error);
    return null;
  }
}

/**
 * Delete a game session
 */
export async function deleteGameSession(gameId: string): Promise<boolean> {
  try {
    // Delete the game (cascades to players and answers)
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId);
    
    if (error) {
      console.error('Error deleting game session:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in deleteGameSession:', error);
    return false;
  }
}

/**
 * Get all active game sessions created by a specific host
 */
export async function getGameSessionsByHostId(hostUserId: string): Promise<GameSession[]> {
  try {
    // Get all games created by this host that aren't finished
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('host_id', hostUserId)
      .not('status', 'eq', 'finished')
      .order('last_activity_at', { ascending: false });
    
    if (gamesError || !gamesData) {
      console.error('Error fetching games for host:', gamesError);
      return [];
    }
    
    // For each game, get the players and construct the GameSession
    const sessions: GameSession[] = [];
    
    for (const gameData of gamesData) {
      // Get players for this game
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gameData.id);
      
      if (playersError) {
        console.error(`Error fetching players for game ${gameData.id}:`, playersError);
        continue;
      }
      
      // Get answers for this game
      const { data: answersData, error: answersError } = await supabase
        .from('answers')
        .select('*')
        .eq('game_id', gameData.id);
      
      if (answersError) {
        console.error(`Error fetching answers for game ${gameData.id}:`, answersError);
        continue;
      }
      
      // Transform the data into the expected format
      const players: Player[] = playersData.map(p => ({
        id: p.socket_id || p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        isConnected: p.is_connected,
        isHost: p.is_host,
        userId: p.user_id
      }));
      
      const playerAnswers: PlayerAnswer[] = answersData.map(a => ({
        playerId: a.player_id,
        questionId: a.question_id,
        answer: a.answer.length === 1 ? a.answer[0] : a.answer,
        isCorrect: a.is_correct,
        timeToAnswer: a.time_to_answer
      }));
      
      // Create the game session
      const gameSession: GameSession = {
        id: gameData.id,
        code: gameData.code,
        hostId: gameData.socket_host_id || gameData.host_id,
        hostUserId: gameData.host_id,
        hostDisconnectedAt: gameData.host_disconnected_at,
        status: gameData.status,
        players,
        currentQuizId: gameData.quiz_id,
        currentQuestionIndex: gameData.current_question_index,
        startedAt: gameData.started_at,
        endedAt: gameData.ended_at,
        playerAnswers,
        createdAt: gameData.created_at,
        lastActivityAt: gameData.last_activity_at || gameData.created_at
      };
      
      sessions.push(gameSession);
    }
    
    return sessions;
  } catch (error) {
    console.error('Error in getGameSessionsByHostId:', error);
    return [];
  }
}