const { Client, GatewayIntentBits, EmbedBuilder, AuditLogEvent } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const CHANNELS = {
    MODERATION: '763446019119251466',
    MUTE_VOICE: '763446086819774484',
    MESSAGES:   '763421646836858891',
    CHANNELS:   '763445919130583091',
    ROLES:      '763444458565009460'
};

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// 1. الرسائل (حذف وتعديل)
client.on('messageDelete', async (message) => {
    if (message.partial || message.author?.bot) return;
    const logChannel = message.guild.channels.cache.get(CHANNELS.MESSAGES);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#FF3333')
        .setAuthor({ name: '𝐂𝐚𝐦𝐨𝐫𝐚 𝐋𝐨𝐠 - حذف رسالة', iconURL: message.guild.iconURL({ dynamic: true }) })
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: '👤 المستخدم', value: `${message.author.tag} (<@${message.author.id}>)`, inline: false },
            { name: '📁 القناة', value: `${message.channel}`, inline: false },
            { name: '💬 المحتوى', value: message.content || '*فقط مرفقات / بدون نص*', inline: false }
        )
        .setTimestamp();

    logChannel.send({ embeds: [embed] });
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (oldMessage.partial || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
    const logChannel = oldMessage.guild.channels.cache.get(CHANNELS.MESSAGES);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setAuthor({ name: '𝐂𝐚𝐦𝐨𝐫𝐚 𝐋𝐨𝐠 - تعديل رسالة', iconURL: oldMessage.guild.iconURL({ dynamic: true }) })
        .setThumbnail(oldMessage.author.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: '👤 المستخدم', value: `${oldMessage.author.tag} (<@${oldMessage.author.id}>)`, inline: false },
            { name: '📁 القناة', value: `${oldMessage.channel}`, inline: false },
            { name: '📝 قبل التعديل', value: oldMessage.content || '*فارغ*', inline: false },
            { name: '✨ بعد التعديل', value: newMessage.content || '*فارغ*', inline: false }
        )
        .setTimestamp();

    logChannel.send({ embeds: [embed] });
});

// 2. العقوبات (Kick, Ban, Timeout)
client.on('guildAuditLogEntryCreate', async (auditLog, guild) => {
    try {
        const { action, executor, target } = auditLog;
        const logChannel = guild.channels.cache.get(CHANNELS.MODERATION);
        if (!logChannel) return;

        if (action === AuditLogEvent.MemberKick && target) {
            const embed = new EmbedBuilder()
                .setColor('#FF4500')
                .setAuthor({ name: '𝐂𝐚𝐦𝐨𝐫𝐚 𝐋𝐨𝐠 - طرد عضو', iconURL: guild.iconURL({ dynamic: true }) })
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '👤 العضو المطرود', value: `${target.tag} (<@${target.id}>)`, inline: false },
                    { name: '🛡️ المشرف المسؤول', value: `${executor ? `${executor.tag} (<@${executor.id}>)` : 'غير معروف'}`, inline: false }
                )
                .setTimestamp();
            return logChannel.send({ embeds: [embed] });
        }

        if (action === AuditLogEvent.MemberBanAdd && target) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setAuthor({ name: '𝐂𝐚𝐦𝐨𝐫𝐚 𝐋𝐨𝐠 - حظر عضو', iconURL: guild.iconURL({ dynamic: true }) })
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '👤 العضو المحظور', value: `${target.tag} (<@${target.id}>)`, inline: false },
                    { name: '🛡️ المشرف المسؤول', value: `${executor ? `${executor.tag} (<@${executor.id}>)` : 'غير معروف'}`, inline: false }
                )
                .setTimestamp();
            return logChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error(err);
    }
});

// 3. الرومات
client.on('channelCreate', (channel) => {
    const logChannel = channel.guild.channels.cache.get(CHANNELS.CHANNELS);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#00FF7F')
        .setAuthor({ name: '𝐂𝐚𝐦𝐨𝐫𝐚 𝐋𝐨𝐠 - إنشاء قناة', iconURL: channel.guild.iconURL({ dynamic: true }) })
        .addFields(
            { name: '📁 اسم القناة', value: `${channel.name}`, inline: true },
            { name: '📌 النوع', value: `${channel.type}`, inline: true }
        )
        .setTimestamp();
    logChannel.send({ embeds: [embed] });
});

client.on('channelDelete', (channel) => {
    const logChannel = channel.guild.channels.cache.get(CHANNELS.CHANNELS);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#DC143C')
        .setAuthor({ name: '𝐂𝐚𝐦𝐨𝐫𝐚 𝐋𝐨𝐠 - حذف قناة', iconURL: channel.guild.iconURL({ dynamic: true }) })
        .addFields(
            { name: '📁 اسم القناة', value: `${channel.name}`, inline: true }
        )
        .setTimestamp();
    logChannel.send({ embeds: [embed] });
});

// 4. الرولات
client.on('roleCreate', (role) => {
    const logChannel = role.guild.channels.cache.get(CHANNELS.ROLES);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#1E90FF')
        .setAuthor({ name: '𝐂𝐚𝐦𝐨𝐫𝐚 𝐋𝐨𝐠 - إنشاء رتبة', iconURL: role.guild.iconURL({ dynamic: true }) })
        .addFields(
            { name: '✨ اسم الرتبة', value: `${role.name}`, inline: true }
        )
        .setTimestamp();
    logChannel.send({ embeds: [embed] });
});

client.on('roleDelete', (role) => {
    const logChannel = role.guild.channels.cache.get(CHANNELS.ROLES);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#B22222')
        .setAuthor({ name: '𝐂𝐚𝐦𝐨𝐫𝐚 𝐋𝐨𝐠 - حذف رتبة', iconURL: role.guild.iconURL({ dynamic: true }) })
        .addFields(
            { name: '✨ اسم الرتبة', value: `${role.name}`, inline: true }
        )
        .setTimestamp();
    logChannel.send({ embeds: [embed] });
});

client.login(process.env.TOKEN);
