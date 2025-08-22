import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    // Read the swagger.json file from the public directory
    const swaggerPath = join(process.cwd(), 'public', 'swagger.json');
    const swaggerContent = await readFile(swaggerPath, 'utf-8');
    const swaggerJson = JSON.parse(swaggerContent);

    return NextResponse.json(swaggerJson, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Error serving swagger.json:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to load API documentation' 
      },
      { status: 500 }
    );
  }
}
