let client;
try {
  client = chrome;
} catch {
  client = browser;
}

const parser = new DOMParser();

const gitHubJiraLinkA = 'gitHubJiraLink__a';
const gitHubJiraLinkAId = `#${gitHubJiraLinkA}`;
const gitHubJiraLinkAClass = `.${gitHubJiraLinkA}`;

const gitHubJiraLinkSpan = 'gitHubJiraLink__span';
const gitHubJiraLinkSpanId = `#${gitHubJiraLinkSpan}`;
const gitHubJiraLinkSpanClass = `.${gitHubJiraLinkSpan}`;

const gitHubJiraLinkMark = 'gitHubJiraLinkWasHere';
const gitHubJiraLinkMarkId = `#${gitHubJiraLinkMark}`;

const isMobile = getIsMobile();
const mainContainerClass = isMobile
  ? '.js-comment, .list.color-icons'
  : '.container.new-discussion-timeline.experiment-repo-nav';
const headerSelector = isMobile
  ? '.discussion-header'
  : '#partial-discussion-header';
const prInfoClass = isMobile
  ? '.pull-request-description-toggle.js-details-container.Details'
  : '.TableObject-item--primary';
const prTitleClass = isMobile ? 'discussion-title' : '.js-issue-title';
const branchNameSpanClass = isMobile
  ? '.css-truncate-target'
  : '.commit-ref.css-truncate.user-select-contain.expandable.head-ref';
const firstCommentClass = isMobile
  ? '.discussion-comment.markdown-body.hide-when-editing'
  : '.d-block.comment-body.markdown-body.js-comment-body';
const prLinksContainerClass = isMobile
  ? '.list.color-icons'
  : '.js-navigation-container.js-active-navigation-container';
const prLinksClass = isMobile
  ? '.list-item'
  : '.link-gray-dark.v-align-middle.no-underline.h4.js-navigation-open';
const bylineClass = '.byline';

const jiraLinkCache = new Map();

client.storage.sync.get({ projects: '[]' }, function(options) {
  const { projects } = options;
  const projectsParsed = JSON.parse(projects);
  async function mainScript() {
    if (alreadyHasLink()) return Promise.resolve();

    const hrefArr = getHrefArr();
    const coveredProject = getCoveredProject(hrefArr, projectsParsed);
    if (coveredProject && onPrShow(hrefArr)) {
      const jiraLinks = getJiraLinks(document, projectsParsed, 'id');
      handlePrShowLinks(jiraLinks);
    } else if (coveredProject && onPrList(hrefArr)) {
      const prLinks = Array.from(document.querySelectorAll(prLinksClass));
      await handlePrListLinks(prLinks, projectsParsed);
    }

    return Promise.resolve();
  }

  function runScript() {
    mainScript().then(() => {
      setTimeout(runScript, 500);
    });
  }

  runScript();
});

function getIsMobile() {
  return Array.from(document.querySelector('body').classList).includes(
    'page-responsive'
  );
}

function getHrefArr() {
  return window.location.pathname.split('/').slice(1);
}

function onPrShow(hrefArr) {
  return hrefArr[2] === 'pull';
}

function onPrList(hrefArr) {
  return hrefArr[2] === 'pulls';
}

function getCoveredProject(hrefArr, projectsParsed) {
  return projectsParsed.find(
    project =>
      hrefArr[0] === project.gitHubOrganization &&
      hrefArr[1] === project.gitHubRepo
  );
}

function alreadyHasLink() {
  const header = document.querySelector(headerSelector);
  const prShowHasLink = Boolean(
    header && header.querySelector(gitHubJiraLinkAId)
  );
  if (prShowHasLink) return true;

  const prLinksContainer = document.querySelector(prLinksContainerClass);
  const prListHasLink = Boolean(
    prLinksContainer && prLinksContainer.querySelector(gitHubJiraLinkAClass)
  );
  if (prListHasLink) return true;

  return false;
}

function getJiraLinks(htmlDoc, projectsParsed, attributeKey, skipPrTitle) {
  const hrefArr = getHrefArr();
  const coveredProject = getCoveredProject(hrefArr, projectsParsed);
  const regex = getRegex(coveredProject.jiraPrefix);

  let prTitleJiraNumbers = [];
  if (!skipPrTitle) {
    const prTitle = htmlDoc.querySelector(prTitleClass);
    prTitleJiraNumbers =
      (prTitle && prTitle.innerText.match(regex)) || prTitleJiraNumbers;
  }

  const header = htmlDoc.querySelector(headerSelector);
  const prInfo = header && header.querySelector(prInfoClass);
  const branchNameSpan = prInfo && prInfo.querySelector(branchNameSpanClass);
  const branchName = branchNameSpan && branchNameSpan.innerHTML;
  const branchNameJiraNumbers = (branchName && branchName.match(regex)) || [];

  const firstComment = htmlDoc.querySelector(firstCommentClass);
  const firstCommentJiraNumbers =
    (firstComment && firstComment.innerText.match(regex)) || [];

  const jiraNumbers = [
    ...new Set([
      ...normalizeJiraNumbers(prTitleJiraNumbers),
      ...normalizeJiraNumbers(branchNameJiraNumbers),
      ...normalizeJiraNumbers(firstCommentJiraNumbers),
    ]),
  ];

  return getJiraLinksFromJiraNumbers(jiraNumbers, attributeKey, coveredProject);
}

function getRegex(jiraPrefix) {
  return new RegExp(`${jiraPrefix}(?:-| )\\d+`, 'gi');
}

function normalizeJiraNumber(jiraNumber) {
  return jiraNumber.replace(' ', '-').toUpperCase();
}

function normalizeJiraNumbers(jiraNumbers) {
  return jiraNumbers.map(jiraNumber => normalizeJiraNumber(jiraNumber));
}

function getJiraLinksFromJiraNumbers(
  jiraNumbers,
  attributeKey,
  coveredProject
) {
  if (!jiraNumbers || !jiraNumbers.length) return [];
  return jiraNumbers.map(jiraNumber => {
    jiraNumber = normalizeJiraNumber(jiraNumber);
    const jiraUrl = `https://${
      coveredProject.jiraOrganization
    }.atlassian.net/browse/${jiraNumber}`;
    const aEl = document.createElement('a');
    aEl.setAttribute(attributeKey, gitHubJiraLinkA);
    aEl.setAttribute('href', jiraUrl);
    aEl.setAttribute('target', '_blank');
    aEl.innerHTML = `JIRA ${jiraNumber.toUpperCase()}`;
    const spanEl = document.createElement('span');
    spanEl.setAttribute(attributeKey, gitHubJiraLinkSpan);
    spanEl.appendChild(aEl);

    return spanEl;
  });
}

function handlePrShowLinks(jiraLinks) {
  const header = document.querySelector(headerSelector);
  const prInfo = header && header.querySelector(prInfoClass);
  jiraLinks.forEach(jiraLink => {
    prInfo.append(jiraLink);
  });
}

async function handlePrListLinks(prLinks, projectsParsed) {
  const result = await Promise.all(
    prLinks.map(prLink => {
      const href = prLink.getAttribute('href');

      const cachedJiraLinks = jiraLinkCache.get(href);
      if (cachedJiraLinks) {
        insertJiraLinks(cachedJiraLinks, prLink);
        return Promise.resolve();
      }

      const hrefArr = getHrefArr();
      const coveredProject = getCoveredProject(hrefArr, projectsParsed);
      const regex = getRegex(coveredProject.jiraPrefix);
      const jiraNumbersFromInnerHtml = prLink.innerHTML.match(regex);
      const jiraLinksFromInnerHtml = getJiraLinksFromJiraNumbers(
        jiraNumbersFromInnerHtml,
        'class',
        coveredProject
      );
      if (jiraLinksFromInnerHtml.length) {
        insertJiraLinks(jiraLinksFromInnerHtml, prLink);
      }

      return fetch(`https://github.com${href}`).then(response => {
        response.text().then(responseText => {
          const htmlDoc = parser.parseFromString(responseText, 'text/html');
          const jiraLinks = getJiraLinks(
            htmlDoc,
            projectsParsed,
            'class',
            true
          );
          const differenceLinks = getDifference(
            jiraLinks,
            jiraLinksFromInnerHtml
          );
          jiraLinkCache.set(href, [
            ...jiraLinksFromInnerHtml,
            ...differenceLinks,
          ]);
          insertJiraLinks(differenceLinks, prLink);
        });
      });
    })
  );

  return result;
}

function insertJiraLinks(jiraLinks, prLink) {
  if (isMobile) {
    const byline = prLink.querySelector(bylineClass);
    if (byline) {
      jiraLinks.forEach(jiraLink => {
        byline.innerHTML += ' ';
        byline.append(jiraLink);
      });
    }
  } else {
    const parentElement = prLink.parentElement;
    const nextNextNextSibling = prLink.nextSibling.nextSibling.nextSibling;
    if (parentElement && nextNextNextSibling) {
      jiraLinks.forEach(jiraLink => {
        parentElement.insertBefore(jiraLink, nextNextNextSibling);
      });
    }
  }
}

function getDifference(jiraLinks1, jiraLinks2) {
  const jiraLinks2Hrefs = jiraLinks2.map(jiraLink => getJiraLinkHref(jiraLink));
  return jiraLinks1.filter(
    jiraLink => !jiraLinks2Hrefs.includes(getJiraLinkHref(jiraLink))
  );
}

function getJiraLinkHref(jiraLink) {
  return jiraLink.querySelector('a').getAttribute('href');
}
