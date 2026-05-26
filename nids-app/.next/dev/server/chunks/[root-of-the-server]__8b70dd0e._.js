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
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: linear-gradient(180deg,rgba(0, 209, 129, 1) 0%, rgba(255, 255, 255, 1) 25%);">
        <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 16px;">Welcome to Nexus</h1>
		<h3>Hello ${fullName || 'there'},</h3>
        <p style="color: #475569; font-size: 16px; line-height: 24px">
          Your account for Nexus has been approved! To get started, please click the button below to set your password.
		</p>
		<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
		<p style="color: #475569; font-size: 16px; line-height: 24px">
		  Akun Nexus Anda telah disetujui! Untuk memulai, silakan klik tombol di bawah ini untuk mengatur kata sandi Anda.
        </p>
		<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
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
    forgotPassword: (fullName, resetLink)=>({
            subject: 'Password Reset Request - Nexus',
            html: `
	  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;background: linear-gradient(180deg,rgba(235, 192, 0, 1) 0%, rgba(255, 255, 255, 1) 25%);">
        <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 16px;">Reset Your Password</h1>
		<h3>Hello ${fullName || 'there'},</h3>
        <p style="color: #475569; font-size: 16px; line-height: 24px">
          We received a request to reset the password for your Nexus account. Click the button below to choose a new password.
		  <p style="color: #94a3b8; font-size: 14px; line-height: 20px;">
          If you didn't request this, you can safely ignore this email. The link will expire in 24 hours.<br><br>
		  </p>
        </p>
		<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
        <p style="color: #475569; font-size: 16px; line-height: 24px">
          Kami menerima permintaan untuk mengatur ulang kata sandi akun Nexus Anda. Klik tombol di bawah ini untuk memilih kata sandi baru.
		  <p style="color: #94a3b8; font-size: 14px; line-height: 20px;">
          Jika Anda tidak meminta ini, Anda dapat mengabaikan email ini. Tautan akan kedaluwarsa dalam 24 jam.<br><br>
		  </p>
        </p>
		<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
        <div style="margin: 32px 0;">
          <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
            Reset Password
          </a>
        </div>
		<p style="color: #94a3b8; font-size: 14px; line-height: 20px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <span style="color: #2563eb; word-break: break-all;">${resetLink}</span>
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
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;background: linear-gradient(180deg,rgba(209, 0, 80, 1) 0%, rgba(255, 255, 255, 1) 25%);">
        <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 16px;">Account Deactivated</h1>
		<h3>Hello ${fullName || 'there'},</h3>
		<p style="color: #475569; font-size: 16px; line-height: 24px;">
          We would like to inform you that your account for Nexus has been deactivated. You will no longer be able to log in or access Nexus.
		</p>
		<p style="color: #475569; font-size: 16px; line-height: 24px;">
		  If you believe this is a mistake, please contact your system administrator.
		</p>
		<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
		<p style="color: #475569; font-size: 16px; line-height: 24px;">
		  Kami ingin memberitahukan bahwa akun Nexus Anda telah dinonaktifkan. Anda tidak akan lagi dapat masuk atau mengakses Nexus.
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 24px;">
		  Jika Anda yakin ini adalah kesalahan, silakan hubungi administrator sistem Anda.
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
"[project]/nids-app/app/api/auth/forgot-password/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/nids-app/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$supabase$2d$admin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/nids-app/lib/supabase-admin.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$email$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/nids-app/lib/email.ts [app-route] (ecmascript)");
;
;
;
async function POST(request) {
    try {
        const { email } = await request.json();
        if (!email) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Missing email'
            }, {
                status: 400
            });
        }
        // 1. Find profile by email
        const { data: profile, error: fetchError } = await __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$supabase$2d$admin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseAdmin"].from('profiles').select('id, full_name, auth_id').eq('email', email).single();
        // Security: Always return success even if email not found
        if (fetchError || !profile) {
            console.warn(`Forgot Password: User not found: ${email}`);
            return __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: true
            });
        }
        // 2. Generate OUR OWN Token
        const setupToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        ;
        // 3. Update Profile with recovery token
        const { error: updateError } = await __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$supabase$2d$admin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseAdmin"].from('profiles').update({
            setup_token: setupToken,
            setup_token_expires: expiresAt
        }).eq('id', profile.id);
        if (updateError) {
            console.error('Forgot Password Update Error:', updateError.message);
            return __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'System error processing request'
            }, {
                status: 500
            });
        }
        // 4. Construct Reset Link
        const resetLink = `${new URL(request.url).origin}/reset-password?token=${setupToken}&type=recovery`;
        // 5. Send the Email (BACKGROUND)
        const template = __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$email$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["emailTemplates"].forgotPassword(profile.full_name || 'there', resetLink);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$lib$2f$email$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["sendEmail"])({
            to: email,
            subject: template.subject,
            html: template.html
        }).then(()=>{
            console.log(`Forgot password email dispatched to ${email}`);
        }).catch((err)=>{
            console.error('Forgot password background email error:', err.message);
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: true
        });
    } catch (err) {
        console.error('Forgot Password API Error:', err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$nids$2d$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Internal Server Error'
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__8b70dd0e._.js.map