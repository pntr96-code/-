const { Client, GatewayIntentBits, EmbedBuilder, AuditLogEvent } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
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

// 2. الحركة الصوتية مع التمييز الدقيق بين الانتقال الذاتي والسحب بواسطة مشرف
client.on('voiceStateUpdate', async (oldState, newState) => {
    const logChannel = newState.guild.channels.cache.get(CHANNELS.CHANNELS);
    if (!logChannel) return;

    const member = newState.member;
    if (!member) return;

    if (oldState.channelId !== newState.channelId) {
        let actionText = '';
        let color = '#3498DB';
        let movedBy = 'نفسه';

        if (!oldState.channelId && newState.channelId) {
            actionText = `انضم إلى الروم الصوتي: ${newState.channel.name}`;
            color = '#2ECC71';
        } else if (oldState.channelId && !newState.channelId) {
            actionText = `غادر الروم الصوتي: ${oldState.channel.name}`;
            color = '#E74C3C';
        } else if (oldState.channelId && newState.channelId) {
            actionText = `انتقل من روم ${oldState.channel.name} إلى ${newState.channel.name}`;
            color = '#F39C12';

            try {
                const fetchedLogs = await newState.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberMove,
                });
                const auditLog = fetchedLogs.entries.first();
                if (auditLog && auditLog.target.id === member.id && (Date.now() - auditLog.createdTimestamp < 4000)) {
                    if (auditLog.executor.id !== member.id) {
                        movedBy = `${auditLog.executor.tag} (<@${auditLog.executor.id}>)`;
                    }
                }
            } catch (e) {
                console.error(e);
            }
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({ name: '𝐂𝐚𝐦𝐨𝐫𝐚 𝐋𝐨𝐠 - حركة صوتية', iconURL: newState.guild.iconURL({ dynamic: true }) })
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '👤 العضو', value: `${member.user.tag} (<@${member.id}>)`, inline: false },
                { name: '📍 التفاصيل', value: actionText, inline: false },
                { name: '🛡️ المسؤول عن النقل', value: movedBy, inline: false }
            )
            .setTimestamp();

        return logChannel.send({ embeds: [embed] });
    }
});

// 3. الميوت والدفن الصوتي
client.on('voiceStateUpdate', async (oldState, newState) => {
    const logChannel = newState.guild.channels.cache.get(CHANNELS.MUTE_VOICE);
    if (!logChannel) return;

    const member = newState.member;
    if (!member) return;

    if (oldState.serverMute !== newState.serverMute || oldState.serverDeaf !== newState.serverDeaf) {
        let status = '';
        if (newState.serverMute) status = 'أعطاه ميوت صوتي (Server Mute)';
        else if (!newState.serverMute && oldState.serverMute) status = 'فك عنه الميوت الصوتي';

        if (newState.serverDeaf) status += ' | كتم الصوت عنه (Deafened)';
        else if (!newState.serverDeaf && oldState.serverDeaf) status += ' | فك الكتم عنه';

        let executor = 'غير معروف';
        try {
            const fetchedLogs = await newState.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberUpdate,
            });
            const auditLog = fetchedLogs.entries.first();
            if (auditLog && auditLog.target.id === member.id) {
                executor = `${auditLog.executor.tag} (<@${auditLog.executor.id}>)`;
            }
        } catch (e) {
            console.error(e);
        }

        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setAuthor({ name: '𝐂𝐚𝐦𝐨𝐫𝐚 𝐋𝐨𝐠 - عقوبة صوتية', iconURL: newState.guild.iconURL({ dynamic: true }) })
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '👤 العضو', value: `${member.user.tag} (<@${member.id}>)`, inline: false },
                { name: '⚙️ الحالة', value: status, inline: false },
                { name: '🛡️ المشرف المسؤول', value: executor, inline: false }
            )
            .setTimestamp();

        return logChannel.send({ embeds: [embed] });
    }
});

// 4. العقوبات الإدارية (Kick, Ban)
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

// 5. الرومات الكتابية
client.on('channelCreate', async (channel) => {
    const logChannel = channel.guild.channels.cache.get(CHANNELS.CHANNELS);
    if (!logChannel) return;

    let executor = 'غير معروف';
    try {
        const fetchedLogs = await channel.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.ChannelCreate,
        });
        const auditLog = fetchedLogs.entries.first();
        if (auditLog) {
            executor = `${auditLog.executor.tag} (<@${auditLog.executor.id}>)`;
        }
    } catch (e) {
        console.error(e);
    }

    const embed = new EmbedBuilder()
        .setColor('#00FF7F')
        .setAuthor({ name: '𝐂𝐚𝐦𝐨𝐫𝐚 𝐋𝐨𝐠 - إنشاء قناة', iconURL: channel.guild.iconURL({ dynamic: true }) })
        .addFields(
            { name: '📁 اسم القناة', value: `${channel.name}`, inline: false },
            { name: '📌 النوع', value: `${channel.type}`, inline: false },
            { name: '🛡️ المشرف المسؤول', value: executor, inline: false }
        )
        .setTimestamp();
    logChannel.send({ embeds: [embed] });
});

client.on('channelDelete', async (channel) => {
    const logChannel = channel.guild.channels.cache.get(CHANNELS.CHANNELS);
    if (!logChannel) return;

    let executor = 'غير معروف';
    try {
        const fetchedLogs = await channel.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.ChannelDelete,
        });
        const auditLog = fetchedLogs.entries.first();
        if (auditLog) {
            executor = `${auditLog.executor.tag} (<@${auditLog.executor.id}>)`;
        }
    } catch (e) {
        console.error(e);
    }

    const embed = new EmbedBuilder()
        .setColor('#DC143C')
        .setAuthor({ name: '𝐂𝐚𝐦𝐨𝐫𝐚 𝐋𝐨𝐠 - حذف قناة', iconURL: channel.guild.iconURL({ dynamic: true }) })
        .addFields(
            { name: '📁 اسم القناة', value: `${channel.name}`, inline: false },
            { name: '🛡️ المشرف المسؤول', value: executor, inline: false }
        )
        .setTimestamp();
    logChannel.send({ embeds: [embed] });
});

// 6. الرولات
client.on('roleCreate', async (role) => {
    const logChannel = role.guild.channels.cache.get(CHANNELS.ROLES);
    if (!logChannel) return;

    let executor = 'غير معروف';
    try {
        const fetchedLogs = await role.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.RoleCreate,
        });
        const auditLog = fetchedLogs.entries.first();
        if (auditLog) {
            executor = `${auditLog.executor.tag} (<@${auditLog.executor.id}>)`;
        }
    } catch (e) {
        console.error(e);
    }

    const embed = new EmbedBuilder()
        .setColor('#1E90FF')
        .setAuthor({ name: '𝐂𝐚𝐦𝐨𝐫𝐚 𝐋𝐨𝐠 - إنشاء رتبة', iconURL: role.guild.iconURL({ dynamic: true }) })
        .addFields(
            { name: '✨ اسم الرتبة', value: `${role.name}`, inline: false },
            { name: '🛡️ المشرف المسؤول', value: executor, inline: false }
        )
        .setTimestamp();
    logChannel.send({ embeds: [embed] });
});

client.on('roleDelete', async (role) => {
    const logChannel = role.guild.channels.cache.get(CHANNELS.ROLES);
    if (!logChannel) return;

    let executor = 'غير معروف';
    try {
        const fetchedLogs = await role.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.RoleDelete,
        });
        const auditLog = fetchedLogs.entries.first();
        if (auditLog) {
            executor = `${auditLog.executor.tag} (<@${auditLog.executor.id}>)`;
        }
    } catch (e) {
        console.error(e);
    }

    const embed = new EmbedBuilder()
        .setColor('#B22222')
        .setAuthor({ name: '𝐂𝐚𝐦𝐨𝐫𝐚 𝐋𝐨𝐠 - حذف رتبة', iconURL: role.guild.iconURL({ dynamic: true }) })
        .addFields(
            { name: '✨ اسم الرتبة', value: `${role.name}`, inline: false },
            { name: '🛡️ المشرف المسؤول', value: executor, inline: false }
        )
        .setTimestamp();
    logChannel.send({ embeds: [embed] });
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const logChannel = newMember.guild.channels.cache.get(CHANNELS.ROLES);
    if (!logChannel) return;

    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
    const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));

    if (addedRoles.size > 0 || removedRoles.size > 0) {
        let executor = 'غير معروف';
        try {
            const fetchedLogs = await newMember.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberRoleUpdate,
            });
            const auditLog = fetchedLogs.entries.first();
            if (auditLog && auditLog.target.id === newMember.id) {
                executor = `${auditLog.executor.tag} (<@${auditLog.executor.id}>)`;
            }
        } catch (e) {
            console.error(e);
        }

        addedRoles.forEach(role => {
            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setAuthor({ name: '𝐂𝐚𝐦𝐨𝐫𝐚 𝐋𝐨𝐠 - إعطاء رتبة لعضو', iconURL: newMember.guild.iconURL({ dynamic: true }) })
                .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '👤 العضو', value: `${newMember.user.tag} (<@${newMember.id}>)`, inline: false },
                    { name: '✨ الرتبة المعطاة', value: `${role.name}`, inline: false },
                    { name: '🛡️ المشرف المسؤول', value: executor, inline: false }
                )
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        });

        removedRoles.forEach(role => {
            const embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setAuthor({ name: '𝐂𝐚𝐦𝐨𝐫𝐚 𝐋𝐨𝐠 - سحب رتبة من عضو', iconURL: newMember.guild.iconURL({ dynamic: true }) })
                .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '👤 العضو', value: `${newMember.user.tag} (<@${newMember.id}>)`, inline: false },
                    { name: '✨ الرتبة المسحوبة', value: `${role.name}`, inline: false },
                    { name: '🛡️ المشرف المسؤول', value: executor, inline: false }
                )
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        });
    }
});

client.login(process.env.TOKEN);
