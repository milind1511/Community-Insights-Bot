const axios = require("axios");
const { response } = require("express");

async function fetchStackOverflow() {
  const questions = [];
  const pageSize = 5;
  let page = 1;
  let hasMore = true;

  const response = await axios.get(
    "https://api.stackexchange.com/2.3/questions",
    {
      params: {
        site: "stackoverflow",
        tagged: "microsoft-teams",
        pagesize: pageSize,
        page,
        order: "desc",
        sort: "creation",
        filter: "withbody",
      },
    }
  );

  return response.data.items.map(
    (q) => q.title + "\n" + q.body + "\n" + "Source : StackOverflow"
  );
}

async function fetchGitHubIssues(repo = "microsoftdocs/msteams-docs") {
  const issues = [];
  const perPage = 5;
  let page = 1;
  const response = await axios.get(
    `https://api.github.com/repos/${repo}/issues`,
    {
      params: {
        state: "open",
        per_page: perPage,
        page,
      },
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`, 
      },
    }
  );
  return response.data.map(
    (issue) => issue.title + "\n" + issue.body + "\n" + "Source : Github"
  );
}

module.exports = { fetchStackOverflow, fetchGitHubIssues };
