import OpenAI from 'openai';
import { QuizTheme } from 'shared';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates quiz theme suggestions based on parameters
 */
export async function generateThemes(
  count: number,
  category?: string,
  audience?: string
): Promise<QuizTheme[]> {
  try {
    // Create the prompt based on parameters
    let prompt = `Suggest ${count} interesting and diverse quiz themes`;
    
    if (category) {
      prompt += ` within the category of ${category}`;
    }
    
    if (audience) {
      prompt += ` suitable for ${audience}`;
    }
    
    prompt += `. For each theme provide a title, brief description, 3 example questions, and audience level (beginner, intermediate, or advanced).`;
    
    // Call OpenAI API to generate themes
    const response = await openai.chat.completions.create({
      model: 'o4-mini-2025-04-16',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant who creates engaging quiz themes. 
Always respond with ONLY a valid JSON object containing an array of themes like this:
{
  "themes": [
    {
      "title": "Astronomy Basics",
      "description": "Test your knowledge of planets, stars, and space phenomena",
      "exampleQuestions": [
        "Which planet is known as the Red Planet?",
        "What is a light-year?",
        "What causes a solar eclipse?"
      ],
      "audience": "beginner"
    }
  ]
}

Include exactly ${count} themes in your response. Make sure your JSON is valid with no trailing commas, properly quoted keys, and no comments.`,
        },
        {
          role: 'user',
          content: prompt + " ONLY return a JSON object with the 'themes' array - no other text before or after.",
        },
      ]
    });
    
    // Parse the response
    const responseContent = response.choices[0].message.content;
    if (!responseContent) {
      throw new Error('No content in response');
    }
    
    // Try to extract JSON from the response in case the model included text before or after the JSON
    let jsonContent = responseContent;
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }
    
    let themeData;
    try {
      // Try to parse the response as JSON
      themeData = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      
      // If regular parsing fails, try to repair common JSON syntax issues
      let repairAttempt = jsonContent
        // Replace single quotes with double quotes
        .replace(/'/g, '"')
        // Fix trailing commas in arrays or objects
        .replace(/,\s*([\]}])/g, '$1');
      
      try {
        themeData = JSON.parse(repairAttempt);
      } catch (repairError) {
        console.error('JSON repair attempt failed:', repairError);
        
        // As a last resort, let's try to manually construct the themes array
        // by extracting theme objects one by one using regex
        try {
          const extractedThemes = [];
          const themeRegex = /\{\s*"title"[\s\S]*?\}\s*[,\]]?/g;
          let themeMatch;
          
          while ((themeMatch = themeRegex.exec(jsonContent)) !== null) {
            let themeStr = themeMatch[0].replace(/,\s*$/, '');
            try {
              const theme = JSON.parse(themeStr);
              extractedThemes.push(theme);
            } catch (e) {
              console.warn('Could not parse individual theme:', themeStr);
            }
          }
          
          if (extractedThemes.length > 0) {
            themeData = { themes: extractedThemes };
          } else {
            throw new Error('Could not extract any valid themes');
          }
        } catch (extractError) {
          console.error('Theme extraction failed:', extractError);
          throw new Error('Failed to parse response as valid JSON');
        }
      }
    }
    
    // Handle the case where themes is not an array or doesn't exist
    if (!themeData.themes || !Array.isArray(themeData.themes)) {
      console.error('Invalid themes data:', themeData);
      throw new Error('Response did not contain a valid themes array');
    }
    
    // Transform the response into QuizTheme objects
    return themeData.themes.map((theme: any) => ({
      title: theme.title,
      description: theme.description,
      exampleQuestions: theme.exampleQuestions || [],
      audience: theme.audience || 'intermediate',
      // In a real implementation, image URLs would be generated separately
      imageUrl: `https://placehold.co/100x100?text=${encodeURIComponent(theme.title)}`,
    }));
  } catch (error) {
    console.error('Error generating themes:', error);
    throw new Error('Failed to generate quiz themes');
  }
}
