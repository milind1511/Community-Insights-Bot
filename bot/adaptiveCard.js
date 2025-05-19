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
        text: `**Pain Point:** ${painPoint?.pain_point_summary || 'N/A'}`,
        wrap: true
      },
      {
        type: 'TextBlock',
        text: `**Sentiment:** ${painPoint?.sentiment || 'N/A'}`,
        wrap: true
      },
      {
        type: 'TextBlock',
        text: `**Feature Area:** ${painPoint?.feature_area || 'N/A'}`,
        wrap: true
      }
    ]
  };
}


module.exports = { createInsightsCard };
