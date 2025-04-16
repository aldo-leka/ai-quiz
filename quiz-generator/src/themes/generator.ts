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
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant who creates engaging quiz themes.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });
    
    // Parse the response
    const responseContent = response.choices[0].message.content;
    if (!responseContent) {
      throw new Error('No content in response');
    }
    
    const themeData = JSON.parse(responseContent);
    
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
