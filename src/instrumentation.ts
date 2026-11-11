/** Runs once when the server starts: drop host keys this app must never use. */
export function register() {
  delete process.env.OPENAI_API_KEY;
}
