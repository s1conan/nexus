module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/nids-app/lib/supabase-admin.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "supabaseAdmin",
    ()=>supabaseAdmin
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/nids-app/node_modules/@supabase/supabase-js/dist/index.mjs [app-route] (ecmascript) <locals>");
;
const supabaseUrl = ("TURBOPACK compile-time value", "https://ohqimdsesbwvfezceoee.supabase.co") || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Supabase Admin: Missing env variables');
}
const supabaseAdmin = (0, __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
}),
"[project]/nids-app/lib/email.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "emailTemplates",
    ()=>emailTemplates,
    "sendEmail",
    ()=>sendEmail
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$resend$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/nids-app/node_modules/resend/dist/index.mjs [app-route] (ecmascript)");
;
const resend = new __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$resend$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Resend"](process.env.RESEND_API_KEY);
async function sendEmail({ to, subject, html, from }) {
    try {
        const { data, error } = await resend.emails.send({
            from: from || process.env.RESEND_FROM_EMAIL || 'Nexus <onboarding@resend.dev>',
            to,
            subject,
            html
        });
        if (error) {
            console.error('Email Service Error:', error);
            throw new Error(error.message);
        }
        return {
            success: true,
            id: data?.id
        };
    } catch (err) {
        console.error('Email Service Unexpected Error:', err);
        throw err;
    }
}
const emailTemplates = {
    invitation: (fullName, inviteLink)=>({
            subject: 'Welcome to Nexus - Complete Your Account',
            html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 16px;">Welcome to Nexus</h1>
        <p style="color: #475569; font-size: 16px; line-height: 24px;">
          Hello ${fullName || 'there'},<br><br>
          Your account for Nexus has been approved! To get started, please click the button below to set your password and access your dashboard.
        </p>
        <div style="margin: 32px 0;">
          <a href="${inviteLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
            Activate Account
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 14px; line-height: 20px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <span style="color: #2563eb; word-break: break-all;">${inviteLink}</span>
        </p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          &copy; ${new Date().getFullYear()} Nexus. All rights reserved.
        </p>
      </div>
    `
        }),
    deactivation: (fullName)=>({
            subject: 'Account Deactivated - Nexus',
            html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 16px;">Account Deactivated</h1>
        <p style="color: #475569; font-size: 16px; line-height: 24px;">
          Hello ${fullName || 'there'},<br><br>
          We are writing to inform you that your account for Nexus has been deactivated. You will no longer be able to log in or access your dashboard.
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 24px;">
          If you believe this is a mistake, please contact your system administrator.
        </p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          &copy; ${new Date().getFullYear()} Nexus. All rights reserved.
        </p>
      </div>
    `
        }),
    // Placeholder for future use
    invoice: (orderId, amount)=>({
            subject: `Invoice for Order #${orderId}`,
            html: `<h1>Invoice</h1><p>Amount: ${amount}</p>`
        })
};
}),
"[project]/nids-app/lib/supabase-server.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createServerSideClient",
    ()=>createServerSideClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/nids-app/node_modules/@supabase/ssr/dist/module/createServerClient.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/nids-app/node_modules/next/headers.js [app-route] (ecmascript)");
;
;
async function createServerSideClient() {
    const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createServerClient"])(("TURBOPACK compile-time value", "https://ohqimdsesbwvfezceoee.supabase.co") || 'https://placeholder.supabase.co', ("TURBOPACK compile-time value", "sb_publishable_I0xfxOstFxbZhm0onhKMAQ_svAhaxId") || 'placeholder', {
        cookies: {
            getAll () {
                return cookieStore.getAll();
            },
            setAll (cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options })=>cookieStore.set(name, value, options));
                } catch  {
                // The `setAll` method was called from a Server Component.
                // This can be ignored if you have middleware refreshing
                // user sessions.
                }
            }
        }
    });
}
}),
"[project]/nids-app/app/api/approve/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/nids-app/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$supabase$2d$admin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/nids-app/lib/supabase-admin.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$email$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/nids-app/lib/email.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/nids-app/lib/supabase-server.ts [app-route] (ecmascript)");
;
;
;
;
async function POST(request) {
    try {
        const { profileId, email, action, fullName, phone } = await request.json();
        if (!profileId || !email || !action) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Missing required fields'
            }, {
                status: 400
            });
        }
        console.log(`API Approve: ${action} for ${email} (Profile: ${profileId})`);
        if (action === 'approve') {
            // 0. Fetch the current profile to get the role
            const { data: profileData, error: profileFetchError } = await __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$supabase$2d$admin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseAdmin"].from('profiles').select('role, auth_id').eq('id', profileId).single();
            if (profileFetchError) {
                console.error('Profile Fetch Error:', profileFetchError.message);
                return __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: profileFetchError.message
                }, {
                    status: 500
                });
            }
            let authId = profileData.auth_id;
            // 1. Ensure Auth User exists
            if (!authId) {
                console.log(`API Approve: Creating new auth user for ${email}`);
                const tempPassword = Math.random().toString(36).slice(-12) + "!";
                const { data: authData, error: authError } = await __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$supabase$2d$admin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseAdmin"].auth.admin.createUser({
                    email,
                    password: tempPassword,
                    email_confirm: true,
                    user_metadata: {
                        full_name: fullName || '',
                        phone: phone || '',
                        role: profileData.role || 'staff'
                    }
                });
                if (authError) {
                    console.error('Auth Creation Error:', authError.message);
                    return __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        error: authError.message
                    }, {
                        status: 500
                    });
                }
                authId = authData.user?.id;
            }
            if (!authId) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: 'Failed to establish Auth ID'
                }, {
                    status: 500
                });
            }
            // 2. Generate OUR OWN Token
            const setupToken = crypto.randomUUID();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
            ;
            // 3. Update Profile with our token
            const { error: profileUpdateError } = await __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$supabase$2d$admin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseAdmin"].from('profiles').update({
                auth_id: authId,
                is_active: true,
                setup_token: setupToken,
                setup_token_expires: expiresAt
            }).eq('id', profileId);
            if (profileUpdateError) {
                console.error('Profile Token Update Error:', profileUpdateError.message);
                return __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: `Failed to initialize security token: ${profileUpdateError.message}`
                }, {
                    status: 500
                });
            }
            // 4. Construct Application Link
            const inviteLink = `${new URL(request.url).origin}/reset-password?token=${setupToken}`;
            // 5. Send the Email (BACKGROUND TASK)
            const template = __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$email$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["emailTemplates"].invitation(fullName, inviteLink);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$email$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["sendEmail"])({
                to: email,
                subject: template.subject,
                html: template.html
            }).catch((err)=>console.error('Background Email Error:', err.message));
            return __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: true,
                auth_id: authId
            });
        } else if (action === 'revoke') {
            // 0. Safety Check: Prevent self-revocation
            const supabaseServer = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createServerSideClient"])();
            const { data: { user: currentUser } } = await supabaseServer.auth.getUser();
            // 1. Get the auth_id and full_name from the profile
            const { data: profile, error: fetchError } = await __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$supabase$2d$admin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseAdmin"].from('profiles').select('auth_id, full_name').eq('id', profileId).single();
            if (fetchError || !profile?.auth_id) {
                console.error('Profile Fetch Error or No Auth ID:', fetchError);
                return __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: 'User has no auth account to revoke'
                }, {
                    status: 400
                });
            }
            if (currentUser && profile.auth_id === currentUser.id) {
                console.warn(`Blocked self-revocation attempt for user: ${currentUser.email}`);
                return __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: 'You cannot revoke your own account access.'
                }, {
                    status: 403
                });
            }
            const authIdToDelete = profile.auth_id;
            const userFullName = profile.full_name || 'User';
            // 2. Update the profile FIRST to break the foreign key constraint
            // and set is_active to false
            const { error: profileUpdateError } = await __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$supabase$2d$admin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseAdmin"].from('profiles').update({
                auth_id: null,
                is_active: false
            }).eq('id', profileId);
            if (profileUpdateError) {
                console.error('Profile Update Error during revocation:', profileUpdateError.message);
                return __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: `Failed to update profile: ${profileUpdateError.message}`
                }, {
                    status: 500
                });
            }
            console.log(`Profile unlinked for ${profileId}. Proceeding to background background cleanup.`);
            // 3. Send the Deactivation Email (BACKGROUND TASK)
            const deactivationTemplate = __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$email$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["emailTemplates"].deactivation(userFullName);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$email$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["sendEmail"])({
                to: email,
                subject: deactivationTemplate.subject,
                html: deactivationTemplate.html
            }).then(()=>{
                console.log(`Deactivation email sent backgrounded`);
            }).catch((err)=>{
                console.warn('Background Deactivation Email Warning:', err.message);
            });
            // 4. Delete the user from Supabase Auth (BACKGROUND TASK)
            // This is the slowest part, so we definitely don't want to wait for it.
            __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$supabase$2d$admin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseAdmin"].auth.admin.deleteUser(authIdToDelete).then(({ error: delError })=>{
                if (delError) {
                    console.error('Background Auth Deletion Error:', delError.message);
                } else {
                    console.log('Background Auth Deletion Success');
                }
            });
            return __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: true
            });
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Invalid action'
        }, {
            status: 400
        });
    } catch (err) {
        console.error('Unexpected API Error:', err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: err.message || 'Internal Server Error'
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__e6c8b657._.js.map