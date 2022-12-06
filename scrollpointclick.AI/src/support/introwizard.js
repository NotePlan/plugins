export const intro = {
    "title": "Hey there!",
    "prompt": "Welcome to the OpenAI GPT-3 plugin for NotePlan.\n\nThis is an unofficial plugin that uses a sometimes unpredictable technology, so expect behaviors to change.\n\nUse the \helpAI command to learn more!",
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

export const modelsInformation = {
    "Davinci": {
        "goodAt": "Complex intent, cause and effect, summarization for audience",
        "cost": "$0.02/1K tokens"
    },
    "Curie": "",
    "Babbage": "",
    "Ada": ""
}