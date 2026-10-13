const { Client, GatewayIntentBits, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
require('dotenv').config();

// --- إنشاء العميل للبوت ---
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

const BOT_VOICE_CHANNEL_ID = '1383608547022995496';

// --- إعداد خادم الويب (Express + Discord OAuth2) ---
const app = express();

app.use(session({
    secret: process.env.SESSION_SECRET || 'camora_secret_session_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scopes: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// 1. الصفحة الرئيسية (عامة للكل)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Camora Log - البوت الرسمي</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .container { background-color: #1e293b; border-radius: 16px; padding: 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 450px; width: 90%; border: 1px solid #334155; }
                h1 { color: #38bdf8; margin-bottom: 10px; font-size: 28px; }
                p { font-size: 16px; color: #94a3b8; line-height: 1.6; }
                .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; margin-bottom: 20px; }
                .online { background: rgba(34, 197, 94, 0.2); color: #22c55e; border: 1px solid #22c55e; }
                .offline { background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid #ef4444; }
                .btn { display: inline-block; width: 80%; padding: 12px; margin-top: 15px; border-radius: 8px; font-weight: bold; text-decoration: none; transition: 0.3s; }
                .btn-discord { background-color: #5865F2; color: white; }
                .btn-discord:hover { background-color: #4752C4; }
                .btn-dash { background-color: #0284c7; color: white; }
                .btn-dash:hover { background-color: #0369a1; }
                .user-info { margin-top: 20px; border-top: 1px solid #334155; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Camora Log Bot</h1>
                <div class="status-badge ${client.user ? 'online' : 'offline'}">
                    ${client.user ? 'البوت متصل ويعمل بنجاح 🟢' : 'البوت غير متصل 🔴'}
                </div>
                <p>البوت المخصص لإدارة وسجلات السيرفر بكل احترافية وأمان.</p>
                <p>السيرفرات الخادمة: <b>${client.guilds.cache.size}</b></p>

                <div class="user-info">
                    ${req.isAuthenticated() 
                        ? `<p>مرحباً بك، <b>${req.user.username}</b> 👋</p>
                           <a href="/dashboard" class="btn btn-dash">الدخول للوحة التحكم</a>
                           <br><br>
                           <a href="/logout" style="color: #ef4444; text-decoration: none; font-size: 14px;">تسجيل الخروج</a>`
                        : `<a href="/auth/discord" class="btn btn-discord">تسجيل الدخول عبر ديسكورد</a>`
                    }
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/dashboard');
});

// دالة حماية لوحة التحكم
function checkAuth(req, res, next) {
    if (!req.isAuthenticated()) return res.redirect('/auth/discord');
    
    const isOwner = req.user.id === process.env.OWNER_ID;
    const hasAdminPermission = req.user.guilds && req.user.guilds.some(g => (g.permissions & 0x8) === 0x8);

    if (isOwner || hasAdminPermission) {
        return next();
    }

    res.send(`
        <html dir="rtl">
        <body style="background:#0f172a; color:#fff; font-family:sans-serif; text-align:center; padding-top:100px;">
            <h2>عذراً، لا تمتلك صلاحيات الإدارة لدخول لوحة التحكم.</h2>
            <a href="/" style="color:#38bdf8;">العودة للصفحة الرئيسية</a>
        </body>
        </html>
    `);
}

app.get('/dashboard', checkAuth, (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>لوحة التحكم - Camora Log</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, sans-serif; background-color: #0f172a; color: #fff; margin: 0; padding: 40px; }
                .card { background-color: #1e293b; border-radius: 12px; padding: 30px; max-width: 600px; margin: 0 auto; border: 1px solid #334155; }
                h2 { color: #38bdf8; }
                a { color: #94a3b8; text-decoration: none; margin-left: 15px; }
                a:hover { color: #fff; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>لوحة تحكم الإدارة</h2>
                <p>أهلاً بك يا مشرفنا: <b>${req.user.username}</b></p>
                <hr style="border-color: #334155;">
                <p>🟢 حالة البوت: يعمل بنجاح.</p>
                <p>🔊 الروم الصوتي المتصل به: ${BOT_VOICE_CHANNEL_ID}</p>
                <br>
                <a href="/">الرئيسية</a>
                <a href="/logout" style="color: #ef4444;">تسجيل الخروج</a>
            </div>
        </body>
        </html>
    `);
});

app.get('/logout', (req, res) => {
    req.logout(() => { res.redirect('/'); });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[WEB] Server running on port ${PORT}`);
});

// --- أحداث البوت الأصلية الكاملة ---
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    if (BOT_VOICE_CHANNEL_ID) {
        try {
            const channel = await client.channels.fetch(BOT_VOICE_CHANNEL_ID);
            if (channel && channel.type === 2) {
                joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                    selfDeaf: true,
                    selfMute: true
                });
            }
        } catch (error) { console.error(error); }
    }
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

// 2. الحركة الصوتية
client.on('voiceStateUpdate', async (oldState, newState) => {
    const logChannel = newState.guild.channels.cache.get(CHANNELS.CHANNELS);
    if (!logChannel) return;
    const member = newState.member;
    if (!member) return;

    if (oldState.channelId !== newState.channelId) {
        let actionText = '';
        let color = '#3498DB';

        if (!oldState.channelId && newState.channelId) {
            actionText = `انضم إلى الروم الصوتي: ${newState.channel.name}`;
            color = '#2ECC71';
        } else if (oldState.channelId && !newState.channelId) {
            actionText = `غادر الروم الصوتي: ${oldState.channel.name}`;
            color = '#E74C3C';
        } else if (oldState.channelId && newState.channelId) {
            actionText = `انتقل من روم ${oldState.channel.name} إلى ${newState.channel.name}`;
            color = '#F39C12';
        }

        let executor = `<@${member.id}>`;
        try {
            const fetchedLogs = await newState.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberMove });
            const auditLog = fetchedLogs.entries.first();
            if (auditLog && auditLog.target && auditLog.target.id === member.id && auditLog.executor) {
                executor = `<@${auditLog.executor.id}>`;
            }
        } catch (e) { console.error(e); }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({ name: '𝐂𝐚𝐦𝐨𝐫𝐚 𝐋𝐨𝐠 - حركة صوتية', iconURL: newState.guild.iconURL({ dynamic: true }) })
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '👤 العضو', value: `${member.user.tag} (<@${member.id}>)`, inline: false },
                { name: '📍 التفاصيل', value: actionText, inline: false },
                { name: '🛡️ المسؤول عن النقل', value: executor, inline: false }
            )
            .setTimestamp();

        return logChannel.send({ embeds: [embed] });
    }
});

// 3. الميوت والكتم الصوتي
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

        let executor = `<@${member.id}>`;
        try {
            const fetchedLogs = await newState.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
            const auditLog = fetchedLogs.entries.first();
            if (auditLog && auditLog.target && auditLog.target.id === member.id && auditLog.executor) {
                executor = `<@${auditLog.executor.id}>`;
            }
        } catch (e) { console.error(e); }

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
                    { name: '🛡️ المشرف المسؤول', value: `${executor ? `<@${executor.id}>` : 'غير معروف'}`, inline: false }
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
                    { name: '🛡️ المشرف المسؤول', value: `${executor ? `<@${executor.id}>` : 'غير معروف'}`, inline: false }
                )
                .setTimestamp();
            return logChannel.send({ embeds: [embed] });
        }
    } catch (err) { console.error(err); }
});

// 5. الرومات الكتابية
client.on('channelCreate', async (channel) => {
    if (!channel.guild) return;
    const logChannel = channel.guild.channels.cache.get(CHANNELS.CHANNELS);
    if (!logChannel) return;
    let executor = 'غير معروف';
    try {
        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate });
        const auditLog = fetchedLogs.entries.first();
        if (auditLog && auditLog.executor) executor = `<@${auditLog.executor.id}>`;
    } catch (e) { console.error(e); }

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
    if (!channel.guild) return;
    const logChannel = channel.guild.channels.cache.get(CHANNELS.CHANNELS);
    if (!logChannel) return;
    let executor = 'غير معروف';
    try {
        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
        const auditLog = fetchedLogs.entries.first();
        if (auditLog && auditLog.executor) executor = `<@${auditLog.executor.id}>`;
    } catch (e) { console.error(e); }

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
        const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate });
        const auditLog = fetchedLogs.entries.first();
        if (auditLog && auditLog.executor) executor = `<@${auditLog.executor.id}>`;
    } catch (e) { console.error(e); }

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
        const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete });
        const auditLog = fetchedLogs.entries.first();
        if (auditLog && auditLog.executor) executor = `<@${auditLog.executor.id}>`;
    } catch (e) { console.error(e); }

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
        let executor = `<@${newMember.id}>`;
        try {
            const fetchedLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
            const auditLog = fetchedLogs.entries.first();
            if (auditLog && auditLog.target && auditLog.target.id === newMember.id && auditLog.executor) {
                executor = `<@${auditLog.executor.id}>`;
            }
        } catch (e) { console.error(e); }

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
                    { name: '👤 العضو', value: `${newMember.user.tag} (<@${newManager.id}>)`, inline: false },
                    { name: '✨ الرتبة المسحوبة', value: `${role.name}`, inline: false },
                    { name: '🛡️ المشرف المسؤول', value: executor, inline: false }
                )
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        });
    }
});

client.login(process.env.TOKEN);
