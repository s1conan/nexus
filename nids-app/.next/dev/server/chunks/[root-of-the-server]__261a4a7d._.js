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
"[project]/lib/supabase-admin.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "supabaseAdmin",
    ()=>supabaseAdmin
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/index.mjs [app-route] (ecmascript) <locals>");
;
const supabaseUrl = ("TURBOPACK compile-time value", "https://ohqimdsesbwvfezceoee.supabase.co") || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Supabase Admin: Missing env variables');
}
const supabaseAdmin = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
}),
"[project]/lib/email.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "emailTemplates",
    ()=>emailTemplates,
    "sendEmail",
    ()=>sendEmail
]);
(()=>{
    const e = new Error("Cannot find module 'resend'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
;
const resend = new Resend(process.env.RESEND_API_KEY);
async function sendEmail({ to, subject, html, from }) {
    try {
        const { data, error } = await resend.emails.send({
            from: from || 'Nexus <onboarding@resend.dev>',
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
    // Placeholder for future use
    invoice: (orderId, amount)=>({
            subject: `Invoice for Order #${orderId}`,
            html: `<h1>Invoice</h1><p>Amount: ${amount}</p>`
        })
};
}),
"[project]/app/api/approve/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$admin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase-admin.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$email$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/email.ts [app-route] (ecmascript)");
;
;
;
async function POST(request) {
    try {
        const { profileId, email, action, fullName, phone } = await request.json();
        if (!profileId || !email || !action) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Missing required fields'
            }, {
                status: 400
            });
        }
        console.log(`API Approve: ${action} for ${email} (Profile: ${profileId})`);
        if (action === 'approve') {
            // 1. Generate the Invitation Link
            const { data: linkData, error: linkError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$admin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseAdmin"].auth.admin.generateLink({
                type: 'invite',
                email,
                options: {
                    redirectTo: `${new URL(request.url).origin}/auth/callback?next=/reset-password`,
                    data: {
                        full_name: fullName || '',
                        phone: phone || ''
                    }
                }
            });
            if (linkError) {
                console.error('Link Generation Error:', linkError.message);
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: linkError.message
                }, {
                    status: 500
                });
            }
            const inviteLink = linkData.properties.action_link;
            const authId = linkData.user?.id;
            if (!inviteLink || !authId) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: 'Failed to generate invitation link'
                }, {
                    status: 500
                });
            }
            // 2. Send the Email using the Centralized Utility and Template
            const template = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$email$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["emailTemplates"].invitation(fullName, inviteLink);
            try {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$email$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["sendEmail"])({
                    to: email,
                    subject: template.subject,
                    html: template.html
                });
                console.log(`Invitation email sent via Centralized Service`);
            } catch (emailError) {
                console.error('Email Dispatch Error:', emailError);
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: `Link generated but email failed to send: ${emailError.message}`
                }, {
                    status: 500
                });
            }
            // 3. Update the profile to link it and set active
            const { error: profileError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$admin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseAdmin"].from('profiles').update({
                auth_id: authId,
                is_active: true
            }).eq('id', profileId);
            if (profileError) {
                console.error('Profile Update Error:', profileError.message);
                // Cleanup: If profile update fails, we might want to delete the auth user
                // but for now we just return the error
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: `Auth created but profile update failed: ${profileError.message}`
                }, {
                    status: 500
                });
            }
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: true,
                auth_id: authId
            });
        } else if (action === 'revoke') {
            // 1. Get the auth_id from the profile
            const { data: profile, error: fetchError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$admin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseAdmin"].from('profiles').select('auth_id').eq('id', profileId).single();
            if (fetchError || !profile?.auth_id) {
                console.error('Profile Fetch Error or No Auth ID:', fetchError);
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: 'User has no auth account to revoke'
                }, {
                    status: 400
                });
            }
            const authIdToDelete = profile.auth_id;
            // 2. Update the profile FIRST to break the foreign key constraint
            // and set is_active to false
            const { error: profileUpdateError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$admin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseAdmin"].from('profiles').update({
                auth_id: null,
                is_active: false
            }).eq('id', profileId);
            if (profileUpdateError) {
                console.error('Profile Update Error during revocation:', profileUpdateError.message);
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: `Failed to update profile: ${profileUpdateError.message}`
                }, {
                    status: 500
                });
            }
            console.log(`Profile unlinked for ${profileId}. Proceeding to delete auth user ${authIdToDelete}`);
            // 3. Delete the user from Supabase Auth
            const { error: authDeleteError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$admin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseAdmin"].auth.admin.deleteUser(authIdToDelete);
            if (authDeleteError) {
                console.error('Auth Deletion Error:', authDeleteError.message);
                // If the user doesn't exist in auth anymore, we've already cleaned up the profile
                if (authDeleteError.message.includes('User not found')) {
                    console.log('User already gone from Auth.');
                } else {
                    // Note: Profile is already updated, but we report the auth deletion failure
                    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        success: true,
                        warning: `Profile deactivated, but failed to delete auth account: ${authDeleteError.message}`
                    });
                }
            }
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: true
            });
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Invalid action'
        }, {
            status: 400
        });
    } catch (err) {
        console.error('Unexpected API Error:', err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: err.message || 'Internal Server Error'
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__261a4a7d._.js.map