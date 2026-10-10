import { handleContact } from '../lib/contact.js';

export async function POST(request) {
  return handleContact(request);
}

export function GET(request) {
  return handleContact(request); // returns 405
}
