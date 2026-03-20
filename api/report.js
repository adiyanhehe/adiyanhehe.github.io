export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send("Method Not Allowed");

    const { postId, offenderName, content, reporter } = req.body;
    const webhookURL = process.env.DISCORD_WEBHOOK_URL; // Set this in Vercel Settings

    if (!webhookURL) {
        return res.status(500).json({ error: "Webhook URL not configured" });
    }

    const reportData = {
        embeds: [{
            title: "🚩 NEXUS HUB REPORT",
            color: 16711680,
            fields: [
                { name: "Offender", value: `[${offenderName}](https://www.roblox.com/users/profile?username=${offenderName})`, inline: true },
                { name: "Reporter", value: reporter || "Anonymous", inline: true },
                { name: "Content", value: `\`\`\`${content}\`\`\`` },
                { name: "Post ID", value: postId.toString() }
            ],
            footer: { text: "Nexus Security Monitor" },
            timestamp: new Date()
        }]
    };

    try {
        await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportData)
        });
        return res.status(200).json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: "Failed to send to Discord" });
    }
}
