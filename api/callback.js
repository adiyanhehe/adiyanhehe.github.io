export default async function handler(req, res) {
    const { code, state } = req.query; // 'state' will tell us if it was threads or discuss
    if (!code) return res.status(400).send("No code provided");

    try {
        const response = await fetch('https://apis.roblox.com/oauth/v1/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.ROBLOX_CLIENT_ID,
                client_secret: process.env.ROBLOX_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: 'https://adiyanhehe-github-io.vercel.app/api/callback'
            })
        });

        const data = await response.json();
        
        const userRes = await fetch('https://apis.roblox.com/oauth/v1/userinfo', {
            headers: { Authorization: `Bearer ${data.access_token}` }
        });

        const user = await userRes.json();
        
        // --- THE FIX ---
        // If state is 'threads', go to threads.html. Otherwise, default to discuss.html.
        const targetPage = state === 'threads' ? '/threads.html' : '/discuss.html';
        
        res.redirect(`${targetPage}?username=${user.preferred_username}&avatar=${user.picture}`);
        
    } catch (e) {
        res.redirect('/discuss.html?error=failed');
    }
}
