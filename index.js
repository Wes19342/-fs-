require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionType, REST, Routes, PermissionsBitField } = require('discord.js');

// Create a new client instance
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
    partials: [Partials.Channel] // Necessary for DM handling
});

const commands = new Map(); // Store dynamic commands here

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// The !addcmd command logic
client.on('messageCreate', async (message) => {
    // Check if the message is the !addcmd command and if the user has Administrator permissions
    if (message.content === '!addcmd') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('You do not have permission to use this command. Only administrators can add new commands.');
        }

        // Create and send buttons to user
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('start_addcmd')
                    .setLabel('Start Command Setup')
                    .setStyle(ButtonStyle.Primary),
            );

        await message.channel.send({ content: 'Click to start setting up your command!', components: [row] });
    }
});

// Handle button interactions and modals
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId === 'start_addcmd') {
            // Check if the interaction user has Administrator permissions
            const guildMember = interaction.guild.members.cache.get(interaction.user.id);
            if (!guildMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: 'You do not have permission to use this button. Only administrators can add new commands.', ephemeral: true });
            }

            // Create a modal to collect the command name and description
            const modal = new ModalBuilder()
                .setCustomId('command_setup')
                .setTitle('Command Setup');

            const nameInput = new TextInputBuilder()
                .setCustomId('commandName')
                .setLabel('Command Name')
                .setStyle(TextInputStyle.Short);

            const descInput = new TextInputBuilder()
                .setCustomId('commandDescription')
                .setLabel('Command Description')
                .setStyle(TextInputStyle.Paragraph);

            const actionRow1 = new ActionRowBuilder().addComponents(nameInput);
            const actionRow2 = new ActionRowBuilder().addComponents(descInput);

            modal.addComponents(actionRow1, actionRow2);

            await interaction.showModal(modal);
        }
    }

    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'command_setup') {
        const commandName = interaction.fields.getTextInputValue('commandName');
        const commandDescription = interaction.fields.getTextInputValue('commandDescription');

        await interaction.reply({ content: `Now I'll DM you to continue setup!` });

        const user = interaction.user;
        user.send(`You are setting up the command \`${commandName}\`. Please provide the command's functionality as JavaScript code.`)
            .then(() => {
                const collector = user.dmChannel.createMessageCollector({ time: 60000 });

                collector.on('collect', async (msg) => {
                    const commandFunctionality = msg.content;

                    // Register command in memory (in practice, this could be stored in a database or file)
                    commands.set(commandName, {
                        description: commandDescription,
                        execute: new Function('message', commandFunctionality) // Create a dynamic function
                    });

                    user.send(`Your command \`${commandName}\` has been set up!`);

                    collector.stop();
                });

                collector.on('end', collected => {
                    if (collected.size === 0) {
                        user.send('Command setup timed out. Please try again.');
                    }
                });
            })
            .catch(error => {
                console.error('Error sending DM:', error);
            });
    }
});

// Dynamic command handler
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const prefix = '!'; // Default command prefix

    if (message.content.startsWith(prefix)) {
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = commands.get(commandName);
        if (command) {
            try {
                // Execute the dynamic command
                command.execute(message);
            } catch (error) {
                console.error(error);
                message.reply('There was an error executing that command.');
            }
        }
    }
});

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);
