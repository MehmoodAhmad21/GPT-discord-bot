// Discord and openai modules
require('dotenv/config');
const { Client } = require('discord.js');
const { OpenAI } = require('openai');

const client = new Client({
    intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent']
});

client.on('ready', () => {
    console.log('The Bot Is Online');

});

// Ignore message if it starts with the prefix
const IGNORE_PREFIX = "!";
const CHANNELS = ['1192277316244623420'];

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
});

client.on('messageCreate', async (message) => {
    // Ignore messages from bots, those starting with the prefix, and messages not in specified channels
    if (message.author.bot || message.content.startsWith(IGNORE_PREFIX) || (!CHANNELS.includes(message.channelId) && !message.mentions.users.has(client.user.id))) {
        return;
    }

    // Send a typing indicator to indicate the bot is processing the message
    await message.channel.sendTyping();

    // Set up an interval to periodically send typing indicators
    const sendTypingInterval = setInterval(() => {
        message.channel.sendTyping();
    }, 5000); // 5 seconds in milliseconds

    // Initialize conversation array to store chat history
    let conversation = [
        {
            role: 'system',
            content: 'Chat GPT is a friendly chatbot.'
        }
    ];

    // Fetch the last 10 messages in the channel (excluding the bot's own messages)
    let prevMessages = await message.channel.messages.fetch({ limit: 10 });
    prevMessages.reverse();

    prevMessages.forEach((msg) => {
        if (msg.author.bot && msg.author.id !== client.user.id) return;
        if (msg.content.startsWith(IGNORE_PREFIX)) return;

        // Get the username from the user's message
        const username = msg.author.username.replace(/\s+/g, '_').replace(/[^\w\s]/gi, '');

        if (msg.author.id === client.user.id) {
            // If the message is from the bot, add it to the conversation as an assistant message
            conversation.push({
                role: 'assistant',
                name: username,
                content: msg.content
            });
            return;
        }

        // If the message is from a user, add it to the conversation as a user message
        conversation.push({
            role: 'user',
            name: username,
            content: msg.content
        });
    });

    let response;
    try {
        // Make the API request to OpenAI to generate a response
        response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: conversation
        });

        if (response && response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content) {
            // Split the response into chunks of 2000 characters
            const responseMessage = response.choices[0].message.content;
            const chunksizelimit = 2000;
            const chunkedMessages = [];
            let currentChunk = '';

            // Split by words
            const words = responseMessage.split(' ');

            for (const word of words) {
                if ((currentChunk + word).length <= chunksizelimit) {
                    currentChunk += word + ' ';
                } else {
                    // Add the current chunk to the array and start a new chunk
                    chunkedMessages.push(currentChunk.trim());
                    currentChunk = word + ' ';
                }
            }

            // Add the last chunk to the array
            if (currentChunk.trim().length > 0) {
                chunkedMessages.push(currentChunk.trim());
            }

            // Send each chunk as a separate message
            for (const chunk of chunkedMessages) {
                await message.reply(chunk);
            }
        } else {
            console.error('Invalid response from OpenAI:', response);
        }
    } catch (error) {
        // Handle errors from the OpenAI API
        console.error('OpenAI Error:\n', error);
        clearInterval(sendTypingInterval);

        // Check if there was no response from OpenAI and provide user feedback
        if (!response) {
            message.reply("I am having some trouble with the OpenAI API. Try again in a moment.");
        }
    }
});

client.login(process.env.TOKEN);
