const { fetchStackOverflow, fetchGitHubIssues } = require('./mcpClient');

async function ingestFeedback() {
  const [gh] = await Promise.all([
    //fetchStackOverflow(),
    fetchGitHubIssues()
  ]);
  return [ ...gh ];
}

module.exports = { ingestFeedback };
