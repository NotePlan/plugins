

export const noteAIWizardPrompts = {
    'gettingStarted': {
        'title': 'Welcome to NoteAI',
        'message': `To get things connected and working, follow this short guide to learn the basics.`,
        'buttons': ['Continue', 'Cancel'],
        'pageTitle': '',
        'pageSummary': '',
        'pageLinks': []
    },
    'aboutGPT3': {
        'title': 'About OpenAI GPT-3',
        'message': `This NotePlan plugin uses OpenAI's GPT-3 API to help you find connected ideas. \n\nIn order to use the plugin, you must first obtain an API Key by creating an account on OpenAI's website. \n\nCreate your account by clicking below. \n\nIf you already have an account, click 'Get API Key' to generate your API key to use with this plugin.  \n\nCopy your API Key to the clipboard.`,
        'buttons': ['Create Account', 'Get API Key'],
        'pageTitle': '',
        'pageSummary': '',
        'pageLinks': []
    },
    'generateAPIKey': {
        'title': 'Generate API Key',
        'message': `Once you have created your account, click below to obtain your API Key to use with this plugin. Copy your API Key to the clipboard.`,
        'buttons': ['Get API Key'],
        'pageTitle': '',
        'pageSummary': '',
        'pageLinks': []
    }
}


export const noteAIWizardPages = {
    'gettingStarted': {
        'title': 'Getting Started',
        'text': `Welcome to **NoteAI.**
        This document is designed to show you around the plugin so that you may use it to its fullest potential. 
        The format of this note is what will be generated with each research request you make using this plugin. This section shows the summary of the requested query and the section below shows connected key topics to continue your exploration.
        Click on the links below to explore all that **NoteAI** has to offer.
        `,
        'links': []
    },
    'understandingModels': {
        'title': 'Understanding the Language Models',
        'text': `
## Understanding the Language Models
OpenAI's text AI features a handful of different language models, each with their own focuses and strong points. This plugin will primarily use **Davinci** due to its ability to handle complexity with ease.
Let's take a closer look at the primary language models currently available. Information for this document is pulled directly from [OpenAI's Documentation](https://beta.openai.com/docs/models/gpt-3). Visit their website for more information.
---
### Davinci
**Description**
Davinci is the most capable model family and can perform any task the other models can perform and often with less instruction. For applications requiring a lot of understanding of the content, like summarization for a specific audience and creative content generation, Davinci is going to produce the best results. These increased capabilities require more compute resources, so Davinci costs more per API call and is not as fast as the other models.
Another area where Davinci shines is in understanding the intent of text. Davinci is quite good at solving many kinds of logic problems and explaining the motives of characters. Davinci has been able to solve some of the most challenging AI problems involving cause and effect.

**Good at:** *Complex intent, cause and effect, summarization for audience*
**Max Request Size**
4,000 tokens
**Training Data**
Up to June 2021
---
### Curie
**Description**
Curie is extremely powerful, yet very fast. While Davinci is stronger when it comes to analyzing complicated text, Curie is quite capable for many nuanced tasks like sentiment classification and summarization. Curie is also quite good at answering questions and performing Q&A and as a general service chatbot.

**Good at:** *Language translation, complex classification, text sentiment, summarization*
**Max Request Size**
2,048 tokens
**Training Data**
Up to October 2019
---
### Babbage
**Description**
Babbage can perform straightforward tasks like simple classification. It’s also quite capable when it comes to Semantic Search ranking how well documents match up with search queries.

**Good at:** *Moderate classification, semantic search classification*
**Max Request Size**
2,048 tokens
**Training Data**
Up to October 2019
---
### Ada
**Description**
Ada is usually the fastest model and can perform tasks like parsing text, address correction and certain kinds of classification tasks that don’t require too much nuance. Ada’s performance can often be improved by providing more context.

**Good at:** *Parsing text, simple classification, address correction, keywords*
**Max Request Size**
2,048 tokens
**Training Data**
Up to October 2019`
    }
}