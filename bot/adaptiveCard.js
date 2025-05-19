function createInsightsCard(title, painPoint = {}) {
  return {
    type: 'AdaptiveCard',
    version: '1.4',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    body: [
      {
        type: 'TextBlock',
        size: 'Medium',
        weight: 'Bolder',
        text: title,
        wrap: true
      },
      {
        type: 'TextBlock',
        text: `**Source:** ${painPoint?.source || 'N/A'}`,
        wrap: true
      },
      {
        type: 'TextBlock',
        text: `**Pain Point:** ${painPoint?.painPoint || 'N/A'}`,
        wrap: true
      },
      {
        type: 'TextBlock',
        text: `**Sentiment:** ${painPoint?.sentiment || 'N/A'}`,
        wrap: true
      },
      {
        type: 'TextBlock',
        text: `**Feature Area:** ${painPoint?.featureArea || 'N/A'}`,
        wrap: true
      }
    ]
  };
}


module.exports = { createInsightsCard };
