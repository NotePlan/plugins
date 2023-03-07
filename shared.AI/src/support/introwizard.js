import { modelOptions } from './helpers.js'

export const intro = {
    "title": "Hey there!",
    "prompt": "Welcome to the OpenAI GPT-3 plugin for NotePlan.\n\nThis is an unofficial plugin that uses a sometimes unpredictable technology, so expect behaviors to change.\n\nUse the /helpAI command to learn more!",
    "buttons": ["Continue", "Cancel"]
}

export const learningOptions = [
    "Models", 
    "Research", 
    "Summarizing Information"
]

export const openAILearningWizard = {
    "Research": {
        "title": "Research Wizard",
        "prompt": "Let's take a look at how we can use the /research command to learn more about a given subject.",
        "buttons": ["Continue", "Cancel"],
        "pages": [
            {
                "title": "Research Subject",
                "prompt": "Simply enter the subject that you would like for the AI to generate for you.",
                "buttons": ["Continue", "Cancel"]
            }
        ]
    },
    "Models": {
        "title": "Models Wizard",
        "prompt": "OpenAI is powered by a family of language models with different capabilities and price points.\n\nSelect a model from the list below to learn more about each.",
        "prompt2": "Select a text model to learn more...",
        "options": ["Davinci", "Curie", "Babbage", "Ada"]
    }
}

export const externalReading = {
    "models": [
        {
            "title": "Finding the right model",
            "link": "https://beta.openai.com/docs/models/finding-the-right-model"
        },
        {
            "title": "Models Overview",
            "link": "https://beta.openai.com/docs/models/overview"
        }
    ]
}

export const modelsInformation = {
    "Davinci": {
        "title": "text-davinci-003",
        "goodAt": "Complex intent, cause and effect, summarization for audience",
        "cost": `$${modelOptions["text-davinci-003"]}/1K tokens`
    },
    "Curie": {
        "title": "text-curie-001",
        "goodAt": "Language translation, complex classification, text sentiment, summarization",
        "cost": `$${modelOptions["text-curie-001"]}/1K tokens`
    },
    "Babbage": {
        "title": "text-babbage-001",
        "goodAt": "Moderate classification, semantic search classification",
        "cost": `$${modelOptions["text-babbage-001"]}/1K tokens`
    },
    "Ada": {
        "title": "text-ada-001",
        "goodAt": "Parsing text, simple classification, address correction, keywords",
        "cost": `$${modelOptions["text-ada-001"]}/1K tokens`
    }
}