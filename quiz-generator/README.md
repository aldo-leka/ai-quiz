# AI Quiz Game - Quiz Generator

This module handles the generation of quizzes using AI services (OpenAI and Claude) and processing documents for custom quizzes.

## Features

- AI-powered quiz generation with different formats
- Theme selection with preview images
- RAG-based document processing (PDF, DOCX)
- Support for multiple quiz types
  - Multiple choice
  - True/False
  - Fill in the blank
  - Flashcards
  - Timed questions

## Usage

### AI Quiz Generation

```typescript
import { generateQuiz } from '../quiz-generator';

const quiz = await generateQuiz({
  theme: 'Greek Mythology',
  type: 'multiple-choice',
  questionCount: 10,
  aiService: 'openai' // or 'claude'
});
```

### Document-Based Quiz Generation

```typescript
import { generateQuizFromDocument } from '../quiz-generator';

const quiz = await generateQuizFromDocument({
  documentUrl: 'https://example.com/document.pdf',
  type: 'multiple-choice',
  questionCount: 10,
  aiService: 'openai' // or 'claude'
});
```

## Folder Structure

```
├── src/
│   ├── ai/                # AI service integrations
│   │   ├── openai.ts      # OpenAI integration
│   │   └── claude.ts      # Claude integration
│   ├── rag/               # RAG implementation
│   │   ├── embeddings.ts  # Document embedding
│   │   ├── retrieval.ts   # Context retrieval
│   │   └── parsers/       # Document parsers
│   ├── themes/            # Theme suggestions
│   ├── templates/         # Prompt templates
│   ├── types.ts           # Type definitions
│   ├── utils.ts           # Helper functions
│   └── index.ts           # Main exports
```