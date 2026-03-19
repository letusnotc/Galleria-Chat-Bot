import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_SCRIPT = path.join(__dirname, '..', 'ai_service.py');

export async function callAiService(action, params) {
  return new Promise((resolve, reject) => {
    const python = spawn('python', [PYTHON_SCRIPT, action]);
    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`Python stdout for ${action}: ${data.toString().trim()}`); // Log stdout
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`Python stderr for ${action}: ${data.toString().trim()}`); // Log stderr
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error(`AI Service error (code ${code}):`, errorOutput);
        return reject(new Error(errorOutput || `AI Service failed with code ${code}`));
      }
      try {
        if (!output.trim()) {
           throw new Error("Empty output from AI service");
        }
        // console.log(`AI Service output for ${action}:`, output.substring(0, 100) + '...');
        resolve(JSON.parse(output));
      } catch (e) {
        console.error(`Failed to parse AI Service output for ${action}. Output:`, output);
        console.error(`Error details:`, e);
        reject(new Error(`Failed to parse AI Service output: ${output}`));
      }
    });

    python.stdin.write(JSON.stringify(params));
    python.stdin.end();
  });
}
