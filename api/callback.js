export default async function handler(req, res) {
    const { code, state } = req.query;
    
    // 1. Check if the Roblox Authorization Code exists
    if (!code) {
        return res.status(400).send("No authorization code provided by Roblox.");
    }

    try {
        // 2. Exchange the Code for an Access Token
        const tokenResponse = await fetch('https://apis.roblox.com/oauth/v1/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.ROBLOX_CLIENT_ID,
                client_secret: process.env.ROBLOX_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                // This MUST match the URL in your Roblox Dashboard character-for-character
                redirect_uri: 'https://adiyanhehe-github-io.vercel.app/api/callback'
            })
        });

        const tokenData = await tokenResponse.json();
        
        if (!tokenData.access_token) {
            throw new Error("Failed to retrieve access token");
        }

        // 3. Fetch the User's Roblox Profile Info
        const userRes = await fetch('https://apis.roblox.com/oauth/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });

        const user = await userRes.json();
        
        // 4. THE FIX: Logic to handle multiple pages
        // If state was sent as 'threads', we go back to threads.html
        // Otherwise, we default to discuss.html
        const targetPage = state === 'threads' ? '/threads.html' : '/discuss.html';
        
        // 5. Final Redirect with user data
        res.redirect(`${targetPage}?username=${user.preferred_username}&avatar=${user.picture}`);

    } catch (error) {
        console.error("Roblox Auth Error:", error);
        // If it fails, send them back to the hub with an error status
        res.redirect('/index.html?error=auth_failed');
    }
}
