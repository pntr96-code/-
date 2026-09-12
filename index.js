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

// الآديهات الخاصة بالرومات
const CHANNELS = {
    MODERATION: '763446019119251466', // الباند، الكيك، والتايم أوت
    MUTE_VOICE: '763446086819774484', // الميوت (الصوتي/الكتابي) والدَفن
    MESSAGES:   '763421646836858891', // الرسائل (حذف وتعديل)
    CHANNELS:   '763445919130583091', // الرومات (إنشاء وحذف وتعديل)
    ROLES:      '763444458565009460'  // الرولات (إنشاء وحذف وتعديل)
};

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// --- 1. قسم الرسائل (حذف وتعديل) ---
client.on('messageDelete', async (message) => {
    if (message.partial || message.author?.bot) return;
    const logChannel = message.guild.channels.cache.get(CHANNELS.MESSAGES);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🗑️ حذف رسالة')
        .addFields(
            { name: 'المستخدم', value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
            { name: 'القناة', value: `${message.channel}`, inline: true },
            { name: 'المحتوى', value: message.content || '*فقط مرفقات / بدون نص*' }
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
        .setTitle('✏️ تعديل رسالة')
        .addFields(
            { name: 'المستخدم', value: `${oldMessage.author.tag} (<@${oldMessage.author.id}>)`, inline: true },
            { name: 'القناة', value: `${oldMessage.channel}`, inline: true },
            { name: 'قبل التعديل', value: oldMessage.content || '*فارغ*' },
            { name: 'بعد التعديل', value: newMessage.content || '*فارغ*' }
        )
        .setTimestamp();

    logChannel.send({ embeds: [embed] });
});

// --- 2. قسم العقوبات (Kick, Ban, Timeout) ---
client.on('guildAuditLogEntryCreate', async (auditLog, guild) => {
    const { action, executor, target, changes } = auditLog;
    const logChannel = guild.channels.cache.get(CHANNELS.MODERATION);
    if (!logChannel) return;

    // حالة الطرد (Kick)
    if (action === AuditLogEvent.MemberKick && target) {
        const embed = new EmbedBuilder()
            .setColor('#FF4500')
            .setTitle('👢 طرد عضو (Kick)')
            .addFields(
                { name: 'العضو', value: `${target.tag} (<@${target.id}>)`, inline: true },
                { name: 'المشرف', value: `${executor ? executor.tag : 'غير معروف'}`, inline: true }
            )
            .setTimestamp();
        return logChannel.send({ embeds: [embed] });
    }

    // حالة الباند (Ban)
    if (action === AuditLogEvent.MemberBanAdd && target) {
        const embed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('🔨 حظر عضو (Ban)')
            .addFields(
                { name: 'العضو', value: `${target.tag} (<@${target.id}>)`, inline: true },
                { name: 'المشرف', value: `${executor ? executor.tag : 'غير معروف'}`, inline: true }
            )
            .setTimestamp();
        return logChannel.send({ embeds: [embed] });
    }

    // حالة التايم أوت (Timeout / Communication Disabled)
    if (action === AuditLogEvent.MemberUpdate && target) {
        const timeoutChange = changes.find(c => c.key === 'communication_disabled_until');
        if (timeoutChange) {
            const isMuted = timeoutChange.new !== null;
            const embed = new EmbedBuilder()
                .setColor(isMuted ? '#FFD700' : '#00FF00')
                .setTitle(isMuted ? '⏳ إعطاء تايم أوت (Timeout)' : '🔓 إزالة التايم أوت')
                .addFields(
                    { name: 'العضو', value: `${target.tag} (<@${target.id}>)`, inline: true },
                    { name: 'المشرف', value: `${executor ? executor.tag : 'غير معروف'}`, inline: true }
                )
                .setTimestamp();
            
            const muteChannel = guild.channels.cache.get(CHANNELS.MUTE_VOICE);
            if (muteChannel) muteChannel.send({ embeds: [embed] });
        }
    }
});

// --- 3. قسم الرومات (Channels) ---
client.on('channelCreate', (channel) => {
    const logChannel = channel.guild.channels.cache.get(CHANNELS.CHANNELS);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#00FF7F')
        .setTitle('📁 إنشاء قناة جديدة')
        .addFields(
            { name: 'اسم القناة', value: `${channel.name}`, inline: true },
            { name: 'النوع', value: `${channel.type}`, inline: true }
        )
        .setTimestamp();
    logChannel.send({ embeds: [embed] });
});

client.on('channelDelete', (channel) => {
    const logChannel = channel.guild.channels.cache.get(CHANNELS.CHANNELS);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#DC143C')
        .setTitle('🗑️ حذف قناة')
        .addFields(
            { name: 'اسم القناة', value: `${channel.name}`, inline: true }
        )
        .setTimestamp();
    logChannel.send({ embeds: [embed] });
});

// --- 4. قسم الرولات (Roles) ---
client.on('roleCreate', (role) => {
    const logChannel = role.guild.channels.cache.get(CHANNELS.ROLES);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#1E90FF')
        .setTitle('✨ إنشاء رتبة جديدة')
        .addFields(
            { name: 'اسم الرتبة', value: `${role.name}`, inline: true }
        )
        .setTimestamp();
    logChannel.send({ embeds: [embed] });
});

client.on('roleDelete', (role) => {
    const logChannel = role.guild.channels.cache.get(CHANNELS.ROLES);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#B22222')
        .setTitle('🗑️ حذف رتبة')
        .addFields(
            { name: 'اسم الرتبة', value: `${role.name}`, inline: true }
        )
        .setTimestamp();
    logChannel.send({ embeds: [embed] });
});

client.login(process.env.TOKEN);