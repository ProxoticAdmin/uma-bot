require('dotenv').config();

const cardsData = require('./umamusume.json')
let keepAlive = require('./keep_alive.js')

keepAlive();

const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    StringSelectMenuBuilder,
    EmbedBuilder
} = require('discord.js');

const client = new Client({
    intents:[
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () =>{
        client.user.setPresence({
        activities: [{
            name: '/rate sr',
            type: 3,
        }],
        status: 'online',
    });
})

client.on('messageCreate', async (message) => {
    if (message.content === '/rate sr') {

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('main_menu')
            .setPlaceholder('Select a stat Type')
            .addOptions([
                {
                    label: 'Speed',
                    description: 'Speed support cards',
                    value: 'action_speed',
                    disabled: true
                },
                {
                    label: 'Stamina',
                    description: 'Stamina support cards',
                    value: 'action_stamina'
                },
                {
                    label: 'Power',
                    description: 'Power support cards',
                    value: 'action_power',
                    disabled: true
                },
                {
                    label: 'Wit',
                    description: 'Wit support cards',
                    value: 'action_wit',
                    disabled: true
                }
            ]);
        
        const row = new ActionRowBuilder()
            .addComponents(selectMenu);
        
        await message.reply({
            content: 'What would you like to do?',
            components: [row]
        });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'main_menu') {
            const selectedValue = interaction.values[0];
            
            switch (selectedValue) {
                case 'action_speed':
                    await showCardSelection(interaction, 'speed');
                    break;
                case 'action_stamina':
                    await showCardSelection(interaction, 'stamina');
                    break;
                case 'action_power':
                    await showCardSelection(interaction, 'power');
                    break;
                    case 'action_wit':
                    await showCardSelection(interaction, 'intelligence');
                    break;
            }
        }
        
        if (interaction.customId === 'card_selection') {
            const selectedCardName = interaction.values[0];
            await showCardRating(interaction, selectedCardName);
        }
    }
});

async function showCardSelection(interaction, cardType) {
    const cards = Object.values(cardsData)
        .filter(card => card.type && card.type.toLowerCase() === cardType.toLowerCase())
        .slice(0, 25);
    
    if (cards.length === 0) {
        await interaction.reply({
            content: `No ${cardType.toUpperCase()} cards found in the database!`,
            ephemeral: true
        });
        return;
    }
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('card_selection')
        .setPlaceholder(`Choose a ${cardType.toLowerCase()} card...`)
        .addOptions(
            cards.map(card => ({
                label: card.name,
                description: `Type: ${card.type.charAt(0).toUpperCase() + card.type.slice(1)}`,
                value: card.name
            }))
        );
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    await interaction.reply({
        content: `Select a ${cardType.toLowerCase()} card:`,
        components: [row],
        ephemeral: true
    });
}

async function showCardRating(interaction, cardName) {
    try {
        const card = Object.values(cardsData).find(c => 
            c.name.toLowerCase() === cardName.toLowerCase()
        );
        
        if (!card) {
            await interaction.reply({
                content: `Card "${cardName}" not found in the database.`,
                ephemeral: true
            });
            return;
        }
        
        const mlbValues = card.effects[0].mlb[0];
        
        const allRatings = calculateAllLimitBreakRatings(card);
        
        const mlbRating = calculateRating(card)
        
        const sp = ((100 + (mlbValues.specialty_priority || 0)) / 
                   (550 + (mlbValues.specialty_priority || 0)) * 100);
        
        const trainingBonus = (mlbValues.friendship_bonus + 
                              (20 * ((mlbValues.mood_effect || 0) / 100)) + 
                              (mlbValues.training_effectiveness || 0));
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`📊 ${card.name}`)
            .setDescription(`**Overall Rating: ${mlbRating}** (at MLB)`)
            .addFields(
                {
                    name: '📈 Training Bonus',
                    value: `**${trainingBonus.toFixed(2)}%**`,
                    inline: true
                },
                {
                    name: '🎯 Specialty Priority',
                    value: `**${sp.toFixed(2)}%**`,
                    inline: true
                },
                {
                    name: '🏁 Race Bonus',
                    value: `**${mlbValues.race_bonus || 0}%**`,
                    inline: true
                },
                {
                    name: '💝 Initial Friendship',
                    value: `**${mlbValues.initial_friendship || 0}**`,
                    inline: true
                },
                {
                    name: '📊 Rating by Limit Break',
                    value: formatRatingsForDisplay(allRatings),
                    inline: false
                }
            )
            .setFooter({ 
                text: `Card Type: ${card.type.toUpperCase()} • Requested by ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();
        
        if (card.support_id) {
            const imageFilename = `${card.support_id}.png`;
            const imagePath = `./Images/${imageFilename}`;
            
                embed.setThumbnail(`attachment://${imageFilename}`);
                
                await interaction.reply({
                    embeds: [embed],
                    files: [{
                        attachment: imagePath,
                        name: imageFilename
                    }],
                    ephemeral: false
                });
                return;
        }
        
    } catch (error) {
        console.error('Error showing card rating:', error);
        await interaction.reply({
            content: 'An error occurred while calculating the rating.',
            ephemeral: true
        });
    }
}

function calculateAllLimitBreakRatings(card) {
    const limitBreaks = ['mlb', '3lb', '2lb', '1lb', '0lb'];
    const ratings = [];
    
    for (const lb of limitBreaks) {
        if (card.effects[0][lb] && card.effects[0][lb][0]) {
            const lbData = card.effects[0][lb][0];
            
            const tempCard = {
                ...card,
                effects: [{
                    [lb]: [lbData]
                }]
            };
            
            const rating = calculateRatingForLimitBreak(tempCard, lb);
            
            ratings.push({
                limitBreak: lb.toUpperCase(),
                rating: rating,
                data: lbData
            });
        }
    }
    
    return ratings.sort((a, b) => {
        const order = { 'MLB': 0, '3LB': 1, '2LB': 2, '1LB': 3, '0LB': 4 };
        return order[a.limitBreak] - order[b.limitBreak];
    });
}

function calculateRatingForLimitBreak(card, limitBreak) {
    const values = card.effects[0][limitBreak][0];
    
    function getStat(key, def = 0) {
        return values[key] !== undefined ? values[key] : def;
    }
    
    const trainingBonus = getStat('friendship_bonus') + 
                         (20 * (getStat('mood_effect') / 100)) + 
                         getStat('training_effectiveness');
    
    const fb = trainingBonus / 100;
    
    const sp = (100 + getStat('specialty_priority')) / 
               (550 + getStat('specialty_priority'));
    
    function calculateMiscStats() {
        const bonusStats = [
            getStat('speed_bonus'),
            getStat('stamina_bonus'),
            getStat('power_bonus'),
            getStat('wit_bonus')
        ];
        
        const initialStats = [
            getStat('initial_speed'),
            getStat('initial_stamina'),
            getStat('initial_power'),
            getStat('initial_wit')
        ];
        
        const totalBonus = bonusStats
            .filter(value => value !== undefined)
            .reduce((sum, value) => sum + value, 0);
        
        const totalInitial = initialStats
            .filter(value => value !== undefined)
            .reduce((sum, value) => sum + value, 0);
        
        return Math.round(((totalBonus * 9) + totalInitial) / 2 + getStat('initial_friendship'));
    }
    
    const raceBonus = getStat('race_bonus');
    const miscStats = calculateMiscStats();
    
    return Math.round((1200 * fb) + (1200 * sp) + (800 * (raceBonus / 100)) + miscStats);
}

function formatRatingsForDisplay(ratings) {
    if (ratings.length === 0) return 'No limit break data available';
    
    const maxRating = Math.max(...ratings.map(r => r.rating));
    const minRating = Math.min(...ratings.map(r => r.rating));
    
    let displayText = '';
    
    for (const r of ratings) {
        const percentage = ((r.rating - minRating) / (maxRating - minRating)) * 100 || 0;
        const bars = Math.round(percentage / 10);
        const progressBar = '█'.repeat(bars) + '░'.repeat(10 - bars);
        
        displayText += `**${r.limitBreak}:** ${r.rating} ${progressBar}\n`;
    }
    
    if (ratings.length > 1) {
        const mlbRating = ratings.find(r => r.limitBreak === 'MLB')?.rating || 0;
        const zeroRating = ratings.find(r => r.limitBreak === '0LB')?.rating || 0;
        
        if (zeroRating > 0) {
            const improvement = ((mlbRating - zeroRating) / zeroRating * 100).toFixed(1);
            displayText += `\n📈 **Improvement from 0LB to MLB:** +${improvement}%`;
        }
    }
    
    return displayText;
}

function calculateRating(arr) {
    const values = arr.effects[0].mlb[0];
    
    function getStat(key, def = 0) {
        return values[key] !== undefined ? values[key] : def;
    }
    
    const trainingBonus = getStat('friendship_bonus') + 
                         (20 * (getStat('mood_effect') / 100)) + 
                         getStat('training_effectiveness');
    
    const fb = trainingBonus / 100;
    
    const sp = (100 + getStat('specialty_priority')) / 
               (550 + getStat('specialty_priority'));
    
    function calculateMiscStats() {
        const bonusStats = [
            getStat('speed_bonus'),
            getStat('stamina_bonus'),
            getStat('power_bonus'),
            getStat('wit_bonus')
        ];
        
        const initialStats = [
            getStat('initial_speed'),
            getStat('initial_stamina'),
            getStat('initial_power'),
            getStat('initial_wit')
        ];
        
        const totalBonus = bonusStats
            .filter(value => value !== undefined)
            .reduce((sum, value) => sum + value, 0);
        
        const totalInitial = initialStats
            .filter(value => value !== undefined)
            .reduce((sum, value) => sum + value, 0);
        
        return Math.round(((totalBonus * 9) + totalInitial) / 2 + getStat('initial_friendship'));
    }
    
    const raceBonus = getStat('race_bonus');
    const miscStats = calculateMiscStats();
    
    return Math.round((1200 * fb) + (1200 * sp) + (800 * (raceBonus / 100)) + miscStats);
}
 

client.login(process.env.TOKEN);