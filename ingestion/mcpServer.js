const { fetchStackOverflow, fetchGitHubIssues } = require('./mcpClient');

async function ingestFeedback() {
  const so = await fetchStackOverflow();
  const gh = await fetchGitHubIssues();
  return [...so, ...gh];
}

module.exports = { ingestFeedback };
