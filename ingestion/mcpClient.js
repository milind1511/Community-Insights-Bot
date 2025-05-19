const axios = require('axios');

async function fetchStackOverflow() {
  const res = await axios.get('https://api.stackexchange.com/2.3/questions?order=desc&sort=activity&tagged=teams&site=stackoverflow');
  return res.data.items.map(q => q.title + '\n' + q.body);
}

async function fetchGitHubIssues(repo = 'microsoftdocs/msteams-docs') {
  const res = await axios.get(`https://api.github.com/repos/${repo}/issues`);
  return res.data.map(issue => issue.title + '\n' + issue.body);
}

module.exports = { fetchStackOverflow, fetchGitHubIssues };
