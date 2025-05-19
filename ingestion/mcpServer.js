const { fetchStackOverflow, fetchGitHubIssues } = require('./mcpClient');

async function ingestFeedback() {
  const [so, gh] = await Promise.all([
    fetchStackOverflow(),
    fetchGitHubIssues()
  ]);
  return [...so, ...gh ];
}

module.exports = { ingestFeedback };
