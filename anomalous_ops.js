/**
 * NEXUS NETWORK - MODULE 05: ANOMALOUS OPERATIONS
 * The "Troll Suite" - 100 Pre-defined Interventions
 * 
 * Rules:
 * - Temporary (1-10s)
 * - Reversible
 * - No data loss
 * - Creator Immunity (Adiyan)
 * - Role hierarchy (Overseer/Guardian)
 */

const ANOMALOUS_OPS = {
    config: {
        killSwitch: false,
        cooldown: 5000,
        lastExecution: 0,
        creatorIdentities: ['adigusi', 'adiyan', 'adiyanhehe', 'adiyachowdhury8@gmail.com', 'adiyanhehe@gmail.com']
    },

    /**
     * MASTER CONTROLLER
     */
    async triggerTroll(featureId, targetUserId) {
        const currentUser = localStorage.getItem('rbx_user');
        const currentUserRole = localStorage.getItem('rbx_role'); // Legacy
        const currentEmail = localStorage.getItem('rbx_email');
        const isAdmin = localStorage.getItem('rbx_is_admin') === 'true';

        // 1. Creator Immunity Check
        if (this.config.creatorIdentities.includes(targetUserId?.toLowerCase())) {
            console.warn("Nexus Sentinel: Blocked attempt to target Creator.");
            return { success: false, error: "TARGET_IMMUNE" };
        }

        // 2. Role Check (Standardized isAdmin or specific roles)
        const isAuthorized = isAdmin || 
                           currentUserRole === 'moderator' || 
                           currentUserRole === 'troller' || 
                           this.config.creatorIdentities.includes(currentEmail);
                           
        if (!isAuthorized) {
            console.error("Nexus Sentinel: Unauthorized access to Anomalous Operations.");
            return { success: false, error: "UNAUTHORIZED" };
        }

        // 3. Global Kill Switch
        if (this.config.killSwitch) {
            return { success: false, error: "SYSTEM_DISABLED" };
        }

        // 4. Cooldown Check
        const now = Date.now();
        if (now - this.config.lastExecution < this.config.cooldown) {
            return { success: false, error: "COOLDOWN_ACTIVE" };
        }
        this.config.lastExecution = now;

        // 5. Execution Logic (Broadcast via Ably)
        const ably = window.ably || window.ablyLink;
        if (ably) {
            const channel = ably.channels.get('site-global-config');
            channel.publish('config_update', {
                action: 'troll',
                target: targetUserId.toLowerCase(),
                value: featureId,
                executor: currentUser
            });

            // Log activity to database (using aligned schema)
            if (window.supabaseClient) {
                await window.supabaseClient.from('admin_audit_log').insert([{
                    admin_username: currentUser,
                    target_username: targetUserId,
                    action_type: featureId,
                    metadata: { 
                        category: this.getCategory(featureId),
                        timestamp: new Date().toISOString()
                    }
                }]);
            }
            return { success: true };
        }
        return { success: false, error: "REALTIME_OFFLINE" };
    },

    getCategory(id) {
        const n = parseInt(id);
        if (n <= 20) return "VISUAL";
        if (n <= 30) return "AUDIO";
        if (n <= 45) return "INPUT";
        if (n <= 55) return "NETWORK";
        if (n <= 70) return "SOCIAL";
        if (n <= 80) return "ENVIRONMENT";
        if (n <= 90) return "MICRO";
        return "CINEMATIC";
    },

    /**
     * FEATURE IMPLEMENTATIONS
     * Called by the receiver (the target user)
     */
    execute(featureId) {
        const featureName = `trigger${featureId}`;
        if (typeof this[featureName] === 'function') {
            console.log(`%c[ANOMALY] Executing: ${featureId}`, 'color: #ff0044; font-weight: bold;');
            this[featureName]();
        } else {
            // Check if it's a numeric ID
            const id = parseInt(featureId);
            const func = this.features[id];
            if (func) func();
        }
    },

    // --- CATEGORY: VISUAL DISTORTIONS [1-20] ---
    trigger1() { // Quantum Blur Pulse
        document.body.classList.add('troll-quantum-blur');
        setTimeout(() => document.body.classList.remove('troll-quantum-blur'), 5000);
    },
    trigger2() { // Pixel Drift
        document.body.classList.add('troll-pixel-drift');
        setTimeout(() => document.body.classList.remove('troll-pixel-drift'), 6000);
    },
    trigger3() { // RGB Split Glitch
        document.body.classList.add('troll-rgb-split');
        setTimeout(() => document.body.classList.remove('troll-rgb-split'), 4000);
    },
    trigger4() { // Inversion Flash
        document.body.classList.add('troll-inversion-flash');
        setTimeout(() => document.body.classList.remove('troll-inversion-flash'), 3000);
    },
    trigger5() { // Neon Overdrive
        document.body.classList.add('troll-neon-overdrive');
        setTimeout(() => document.body.classList.remove('troll-neon-overdrive'), 5000);
    },
    trigger6() { // Ghost Frames
        for (let i = 0; i < 5; i++) {
            const clone = document.body.cloneNode(true);
            clone.classList.add('troll-ghost-frame');
            clone.style.left = `${(i + 1) * 10}px`;
            clone.style.top = `${(i + 1) * 10}px`;
            document.body.appendChild(clone);
            setTimeout(() => clone.remove(), 2000 + (i * 200));
        }
    },
    trigger7() { // Screen Melt
        document.body.classList.add('troll-screen-melt');
        setTimeout(() => document.body.classList.remove('troll-screen-melt'), 8000);
    },
    trigger8() { // Static Noise Overlay
        document.body.classList.add('troll-static-overlay');
        setTimeout(() => document.body.classList.remove('troll-static-overlay'), 4000);
    },
    trigger9() { // Warp Tunnel
        gsap.to(document.body, { borderRadius: '100%', scale: 0.5, duration: 1, repeat: 1, yoyo: true });
    },
    trigger10() { // Frame Skip
        let i = 0;
        const intr = setInterval(() => {
            document.body.style.opacity = i++ % 2 === 0 ? '0.1' : '1';
            if (i > 10) { clearInterval(intr); document.body.style.opacity = '1'; }
        }, 100);
    },
    trigger11() { // Glass Fracture
        document.body.classList.add('troll-glass-fracture');
        setTimeout(() => document.body.classList.remove('troll-glass-fracture'), 7000);
    },
    trigger12() { // Scanline Sweep
        document.body.classList.add('troll-scanline');
        setTimeout(() => document.body.classList.remove('troll-scanline'), 5000);
    },
    trigger13() { // Depth Collapse
        gsap.to(document.body, { perspective: 100, rotateX: 30, duration: 2, repeat: 1, yoyo: true });
    },
    trigger14() { // UI Echo Clone
        const clone = document.body.cloneNode(true);
        Object.assign(clone.style, { position: 'fixed', inset: '50px', opacity: '0.5', pointerEvents: 'none', zIndex: '99999' });
        document.body.appendChild(clone);
        setTimeout(() => clone.remove(), 4000);
    },
    trigger15() { // Color Cycle Storm
        document.body.classList.add('troll-color-cycle');
        setTimeout(() => document.body.classList.remove('troll-color-cycle'), 6000);
    },
    trigger16() { // Vignette Lock
        document.body.style.boxShadow = 'inset 0 0 200px #000, inset 0 0 200px #000, inset 0 0 200px #000';
        setTimeout(() => document.body.style.boxShadow = '', 4000);
    },
    trigger17() { // Aspect Warp
        gsap.to(document.body, { scaleX: 1.5, scaleY: 0.5, duration: 1, repeat: 3, yoyo: true });
    },
    trigger18() { // Flash Freeze Frame
        const snap = document.createElement('div');
        Object.assign(snap.style, { position: 'fixed', inset: 0, background: 'white', zIndex: 1000000, opacity: 1 });
        document.body.appendChild(snap);
        gsap.to(snap, { opacity: 0, duration: 2, onComplete: () => snap.remove() });
    },
    trigger19() { // Hologram Flicker
        gsap.to(document.body, { opacity: 0.3, skewX: 10, duration: 0.1, repeat: 20, yoyo: true });
    },
    trigger20() { // Matrix Cascade
        if (typeof window.triggerMatrixEffect === 'function') window.triggerMatrixEffect();
    },

    // --- CATEGORY: AUDIO MANIPULATION [21-30] ---
    // (Assuming sounds are available or using synthesized notes)
    triggerAudioEffect(freq, duration) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if(!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        setTimeout(() => { osc.stop(); audioCtx.close(); }, duration * 1000);
    },
    trigger21() { // Echo Burst
        for(let i=0; i<3; i++) setTimeout(() => this.triggerAudioEffect(440, 0.5), i*200);
    },
    trigger22() { // Glitch Clicks
        for(let i=0; i<5; i++) setTimeout(() => this.triggerAudioEffect(Math.random()*1000, 0.1), i*100);
    },
    trigger24() { // Frequency Sweep
        this.triggerAudioEffect(100, 2);
    },
    trigger28() { // Alarm Flick
        let i = 0;
        const intr = setInterval(() => {
            this.triggerAudioEffect(880, 0.2);
            if(i++ > 5) clearInterval(intr);
        }, 300);
    },
    trigger30() { // Silent Drop
        // No audio to mute specifically in core, but we could pause background vids
        document.querySelectorAll('video').forEach(v => v.muted = true);
        setTimeout(() => document.querySelectorAll('video').forEach(v => v.muted = false), 5000);
    },

    // --- CATEGORY: INPUT INTERFERENCE [31-45] ---
    trigger31() { // Cursor Drift
        const style = document.createElement('style');
        style.innerText = `* { cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="5" cy="5" r="5" fill="red"/></svg>'), auto !important; }`;
        document.head.appendChild(style);
        setTimeout(() => style.remove(), 5000);
    },
    trigger32() { // Click Delay
        const block = (e) => {
            e.preventDefault();
            setTimeout(() => {
                const el = document.elementFromPoint(e.clientX, e.clientY);
                if(el && el.click) el.click();
            }, 500);
        };
        window.addEventListener('click', block, { capture: true, once: true });
    },
    trigger33() { // Typing Echo
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            const echo = (e) => {
                if (e.key.length === 1) {
                    setTimeout(() => input.value += e.key, 100);
                }
            };
            input.addEventListener('keydown', echo);
            setTimeout(() => input.removeEventListener('keydown', echo), 5000);
        });
    },
    trigger34() { // Key Shuffle Illusion
        const shuffle = (e) => {
            if (e.key.length === 1) {
                e.preventDefault();
                const randomChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
                const input = e.target;
                if (input.value !== undefined) input.value += randomChar;
            }
        };
        window.addEventListener('keydown', shuffle, true);
        setTimeout(() => window.removeEventListener('keydown', shuffle, true), 3000);
    },
    trigger35() { // Cursor Trail
        const trail = (e) => {
            const dot = document.createElement('div');
            Object.assign(dot.style, { position:'fixed', left:e.clientX+'px', top:e.clientY+'px', width:'10px', height:'10px', background:'var(--accent)', borderRadius:'50%', pointerEvents:'none', zIndex:9999999 });
            document.body.appendChild(dot);
            gsap.to(dot, { opacity:0, scale:0, duration:1, onComplete:()=>dot.remove() });
        };
        window.addEventListener('mousemove', trail);
        setTimeout(() => window.removeEventListener('mousemove', trail), 8000);
    },
    trigger36() { // Reverse Scroll
        const flip = (e) => {
            window.scrollBy(0, -e.deltaY * 2);
            e.preventDefault();
        };
        window.addEventListener('wheel', flip, { passive: false });
        setTimeout(() => window.removeEventListener('wheel', flip), 5000);
    },
    trigger37() { // Input Freeze Spike
        const shield = document.createElement('div');
        Object.assign(shield.style, { position:'fixed', inset:0, zIndex:2000000, background:'transparent', cursor:'wait' });
        document.body.appendChild(shield);
        setTimeout(() => shield.remove(), 1500);
    },
    trigger38() { // Button Dodge
        const dodge = (e) => {
            const btn = e.target.closest('button, .interactable, .nav-item');
            if(btn) gsap.to(btn, { x: (Math.random()-0.5)*150, y: (Math.random()-0.5)*150, duration: 0.2 });
        };
        window.addEventListener('mouseover', dodge);
        setTimeout(() => window.removeEventListener('mouseover', dodge), 7000);
    },
    trigger41() { // Sticky Cursor
        document.body.style.cursor = 'wait';
        const lag = (e) => {
             const items = document.querySelectorAll('.interactable, button');
             items.forEach(el => {
                 const rect = el.getBoundingClientRect();
                 if (Math.abs(e.clientX - (rect.left + rect.width/2)) < 50 && Math.abs(e.clientY - (rect.top + rect.height/2)) < 50) {
                     gsap.to(window, { scrollTo: { y: window.scrollY + 10 }, duration: 0.1 });
                 }
             });
        };
        window.addEventListener('mousemove', lag);
        setTimeout(() => { window.removeEventListener('mousemove', lag); document.body.style.cursor = ''; }, 5000);
    },
    trigger45() { // Micro Shake Input
        const shake = () => {
            gsap.to(document.body, { x: (Math.random()-0.5)*5, y: (Math.random()-0.5)*5, duration: 0.05, repeat: 20, yoyo: true });
        };
        shake();
    },

    // --- CATEGORY: NETWORK ILLUSIONS [46-55] ---
    trigger46() { // Fake Reconnect
        window.showTopNotification?.("CRITICAL_ERROR: SIGNAL_DEGRADATION_DETECTED. RE-ESTABLISHING...", "error", true);
        setTimeout(() => window.showTopNotification?.("NEURAL_LINK_STABILIZED.", "info"), 4000);
    },
    trigger47() { // Signal Drop Bar
        const bar = document.createElement('div');
        Object.assign(bar.style, { position:'fixed', top:'10px', right:'10px', background:'red', color:'white', padding:'5px 10px', borderRadius:'5px', fontSize:'0.6rem', zIndex:999999, fontWeight:900 });
        bar.innerText = "SIGNAL: 0.1% | PACKET_LOSS: 98%";
        document.body.appendChild(bar);
        setTimeout(() => bar.remove(), 6000);
    },
    trigger52() { // Loading Loop
        const loader = document.createElement('div');
        Object.assign(loader.style, { position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:2000000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'white', fontWeight:950, fontFamily:'monospace' });
        loader.innerHTML = '<div class="spinner" style="width:50px; height:50px; border:5px solid #333; border-top-color:#ff0044; border-radius:50%; animation: spin 1s infinite linear;"></div><div style="margin-top:20px;">SERIALIZING_REALITY... (88%)</div><style>@keyframes spin { to { transform: rotate(360deg); } }</style>';
        document.body.appendChild(loader);
        setTimeout(() => loader.remove(), 6000);
    },

    // --- CATEGORY: SOCIAL CHAOS [56-70] ---
    trigger56() { // Ghost Typing
        window.showTopNotification?.("SYSTEM_OVERSEER IS TYPING...", "info");
        setTimeout(() => window.showTopNotification?.("SYSTEM_OVERSEER: 'WE ARE WATCHING.'", "info"), 3000);
    },
    trigger58() { // Fake Mention Ping
        if (window.showTopNotification) window.showTopNotification("MENTIONED BY @ADMIN IN #GENERAL", "info");
        this.triggerAudioEffect(660, 0.3);
    },
    trigger60() { // Reaction Flood
        for(let i=0; i<40; i++) {
            setTimeout(() => {
                const em = document.createElement('div');
                em.innerText = ['🔥','💀','🚀','💎','💯','🤡','❓'][Math.floor(Math.random()*7)];
                Object.assign(em.style, { position:'fixed', left:Math.random()*100+'vw', bottom:'-50px', fontSize:'2.5rem', zIndex:9999999, pointerEvents:'none' });
                document.body.appendChild(em);
                gsap.to(em, { y: -window.innerHeight - 150, x: (Math.random()-0.5)*400, rotation: Math.random()*360, duration: 2.5, ease: "power1.out", onComplete:()=>em.remove() });
            }, i*80);
        }
    },
    trigger67() { // Identity Swap Flash
        const pfps = document.querySelectorAll('img');
        pfps.forEach(img => {
            const old = img.src;
            img.src = 'https://i.ibb.co/VYkS9Gf/glitch-avatar.png';
            setTimeout(() => img.src = old, 3000);
        });
    },

    // --- CATEGORY: ENVIRONMENT EFFECTS [71-80] ---
    trigger71() { // Dark Mode Pulse
        let i = 0;
        const current = document.body.classList.contains('light-mode');
        const intr = setInterval(() => {
            document.body.classList.toggle('light-mode');
            if(i++ > 12) { 
                clearInterval(intr); 
                if(current) document.body.classList.add('light-mode');
                else document.body.classList.remove('light-mode');
            }
        }, 200);
    },
    trigger74() { // Light Flash
        const flash = document.createElement('div');
        Object.assign(flash.style, { position:'fixed', inset:0, background:'white', zIndex:2000000, opacity:0 });
        document.body.appendChild(flash);
        gsap.to(flash, { opacity:1, duration:0.1, yoyo:true, repeat:1, onComplete:()=>flash.remove() });
    },
    trigger75() { // Fog Overlay
        document.body.classList.add('troll-fog');
        setTimeout(() => document.body.classList.remove('troll-fog'), 8000);
    },
    trigger79() { // Horizon Tilt
        gsap.to(document.body, { rotate: 3, duration: 1.5, repeat: 1, yoyo: true, ease: "sine.inOut" });
    },

    // --- CATEGORY: MICRO-INTERACTIONS [81-90] ---
    trigger81() { // Button Bounce
        const bounce = (e) => {
            const btn = e.target.closest('button, .interactable');
            if(btn) gsap.from(btn, { y: -30, duration: 0.6, ease: "bounce.out" });
        };
        window.addEventListener('mouseover', bounce);
        setTimeout(() => window.removeEventListener('mouseover', bounce), 8000);
    },
    trigger83() { // Ripple Click
        const ripple = (e) => {
            const r = document.createElement('div');
            Object.assign(r.style, { position:'fixed', left:e.clientX+'px', top:e.clientY+'px', width:'1px', height:'1px', border:'2px solid var(--accent)', borderRadius:'50%', pointerEvents:'none', zIndex:9999999 });
            document.body.appendChild(r);
            gsap.to(r, { width: 200, height: 200, opacity: 0, x: -100, y: -100, duration: 0.6, onComplete:()=>r.remove() });
        };
        window.addEventListener('mousedown', ripple);
        setTimeout(() => window.removeEventListener('mousedown', ripple), 5000);
    },
    trigger84() { // Icon Spin
        document.querySelectorAll('icon, .nav-item, .logo').forEach(el => {
            gsap.to(el, { rotation: 360, duration: 0.8, ease: "back.out(2)" });
        });
    },

    // --- CATEGORY: CINEMATIC EVENTS [91-100] ---
    trigger93() { // Zoom Pulse
        gsap.to(document.body, { scale: 1.05, duration: 0.5, repeat: 3, yoyo: true });
    },
    trigger95() { // Focus Spotlight
        const spot = document.createElement('div');
        Object.assign(spot.style, { position:'fixed', inset:0, zIndex:1000000, background:'radial-gradient(circle at center, transparent 150px, rgba(0,0,0,0.92) 250px)', pointerEvents:'none', transition:'background 0.1s' });
        document.body.appendChild(spot);
        const move = (e) => spot.style.background = `radial-gradient(circle at ${e.clientX}px ${e.clientY}px, transparent 150px, rgba(0,0,0,0.92) 250px)`;
        window.addEventListener('mousemove', move);
        setTimeout(() => { window.removeEventListener('mousemove', move); spot.remove(); }, 8000);
    },
    trigger96() { // Shockwave Ripple
        const wave = document.createElement('div');
        Object.assign(wave.style, { position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:0, height:0, border:'10px solid var(--accent)', borderRadius:'50%', zIndex:2000000, pointerEvents:'none' });
        document.body.appendChild(wave);
        gsap.to(wave, { width:'200vw', height:'200vw', opacity:0, duration:1.5, onComplete:()=>wave.remove() });
    },
    trigger98() { // Cinematic Bars
        document.body.classList.add('troll-cinematic-bars');
        setTimeout(() => document.body.classList.remove('troll-cinematic-bars'), 6000);
    },
    trigger100() { // Reality Glitch Event (Ultimate Combo)
        this.trigger3();
        this.trigger8();
        this.trigger79();
        this.triggerAudioEffect(100, 3);
        setTimeout(() => { 
            this.trigger15(); 
            this.trigger60(); 
            this.trigger96();
        }, 3000);
    },

    /**
     * EXTENDED LIST OF ALL 100 FEATURES (MAPPER)
     */
    features: {}
};

// Auto-generate missing triggers with generic behavior to ensure all 100 exist
for(let i=1; i<=100; i++) {
    if(!ANOMALOUS_OPS[`trigger${i}`]) {
        ANOMALOUS_OPS[`trigger${i}`] = function() {
            console.log(`Executing Generic Feature ${i}`);
            // Provide a default "glitch" visual for undefined ones
            document.body.style.filter = 'hue-rotate(90deg) contrast(1.5)';
            setTimeout(() => document.body.style.filter = '', 3000);
        };
    }
}

// Attach to window
window.ANOMALOUS_OPS = ANOMALOUS_OPS;

// Hook into the global listener defined in global.js
// Note: global.js has 'executeTrollAction(value)'
// We should override it or handle it there.
if(window.executeTrollAction) {
    const originalTroll = window.executeTrollAction;
    window.executeTrollAction = (type) => {
        // If type starts with 'trigger', it's an ID
        if(type.startsWith('trigger')) {
             ANOMALOUS_OPS.execute(type.replace('trigger', ''));
        } else if (!isNaN(type)) {
             ANOMALOUS_OPS.execute(type);
        } else {
            // Check mapping
            const map = {
                'rickroll': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'matrix': '20',
                'freeze': '37',
                'glitch': '4',
                'shake': '45',
                'lightmode': '71'
            };
            if(map[type]) {
                if(map[type].startsWith('http')) window.location.href = map[type];
                else ANOMALOUS_OPS.execute(map[type]);
            } else {
                originalTroll(type);
            }
        }
    };
}
