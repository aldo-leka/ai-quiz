import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import { createReadStream } from 'fs';

interface DocumentContent {
  text: string;
  title?: string;
  metadata?: Record<string, any>;
}

/**
 * Processes a document from a URL or file path
 */
export async function processDocument(documentUrl: string): Promise<DocumentContent> {
  try {
    // For now, we assume documentUrl is a local file path
    // In a real implementation, this would handle fetching from remote URLs as well
    
    // Get the file extension
    const fileExt = path.extname(documentUrl).toLowerCase();
    
    let content: DocumentContent;
    
    switch (fileExt) {
      case '.pdf':
        content = await processPdf(documentUrl);
        break;
      case '.docx':
        content = await processDocx(documentUrl);
        break;
      default:
        throw new Error(`Unsupported file format: ${fileExt}`);
    }
    
    return content;
  } catch (error) {
    console.error('Error processing document:', error);
    throw new Error('Failed to process document');
  }
}

async function processPdf(filePath: string): Promise<DocumentContent> {
  try {
    // Read the PDF file
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    
    return {
      text: data.text,
      title: path.basename(filePath, '.pdf'),
      metadata: {
        info: data.info,
        pageCount: data.numpages,
      },
    };
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw new Error('Failed to process PDF document');
  }
}

async function processDocx(filePath: string): Promise<DocumentContent> {
  try {
    // Read the DOCX file
    const result = await mammoth.extractRawText({ path: filePath });
    
    return {
      text: result.value,
      title: path.basename(filePath, '.docx'),
      metadata: {},
    };
  } catch (error) {
    console.error('Error processing DOCX:', error);
    throw new Error('Failed to process DOCX document');
  }
}
