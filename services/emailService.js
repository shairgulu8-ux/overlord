import { Resend } from "resend";

const resend = new Resend(
    process.env.RESEND_API_KEY
);

/*
=========================================
SEND OTP EMAIL
=========================================
*/

export async function sendOTPEmail(
    email,
    otp
) {

    if (!process.env.RESEND_API_KEY) {

        throw new Error(
            "RESEND_API_KEY is missing."
        );

    }

    if (!process.env.FROM_EMAIL) {

        throw new Error(
            "FROM_EMAIL is missing."
        );

    }

    try {

        const { data, error } =
            await resend.emails.send({

                from:
                    process.env.FROM_EMAIL,

                to: email,

                subject:
                    "Verify your GTCFX account",

                html: `
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width, initial-scale=1.0">

<title>Email Verification</title>

</head>

<body
style="
margin:0;
padding:0;
background:#f4f6fb;
font-family:Arial,Helvetica,sans-serif;
">

<table
width="100%"
cellpadding="0"
cellspacing="0">

<tr>

<td
align="center"
style="padding:40px 20px;">

<table
width="600"
cellpadding="0"
cellspacing="0"
style="
background:#ffffff;
border-radius:16px;
overflow:hidden;
box-shadow:0 15px 40px rgba(0,0,0,.08);
">

<tr>

<td
style="
background:linear-gradient(135deg,#7aa7ff,#9b7bff);
padding:28px;
text-align:center;
">

<h1
style="
margin:0;
color:#ffffff;
font-size:30px;
">

GTCFX

</h1>

<p
style="
margin-top:10px;
color:#f0edff;
font-size:15px;
">

Secure Email Verification

</p>

</td>

</tr>

<tr>

<td
style="
padding:40px;
">

<h2
style="
margin-top:0;
color:#222;
">

Verify your email

</h2>

<p
style="
font-size:16px;
line-height:28px;
color:#555;
">

Hi,

<br><br>

Use the verification code below
to complete your registration.

</p>

<div
style="
margin:35px 0;
background:#f1eeff;
border:2px dashed #8b5cf6;
border-radius:14px;
padding:25px;
text-align:center;
">

<div
style="
font-size:42px;
font-weight:bold;
letter-spacing:12px;
color:#7c3aed;
">

${otp}

</div>

</div>

<p
style="
font-size:15px;
color:#555;
line-height:26px;
">

This OTP is valid for
<strong>1 minute</strong>.
Never share this code with anyone.

</p>

<p
style="
font-size:15px;
line-height:26px;
color:#555;
">

If you didn't request this verification,
you can safely ignore this email.
Your account will remain secure.

</p>

<hr
style="
margin:35px 0;
border:none;
border-top:1px solid #eeeeee;
">

<p
style="
font-size:13px;
line-height:22px;
color:#888;
text-align:center;
">

This email was sent automatically by
<strong>GTCFX</strong>.

Please do not reply to this email.

</p>

</td>

</tr>

<tr>

<td
style="
background:#fafafa;
padding:18px;
text-align:center;
font-size:12px;
color:#999;
">

© ${new Date().getFullYear()} GTCFX.
All rights reserved.

</td>

</tr>

</table>

</td>

</tr>

</table>

</body>

</html>
`

            });

        if (error) {

            console.error(
                "Resend Error:",
                error
            );

            throw new Error(
                "Failed to send verification email."
            );

        }

        return data;

    }

    catch (err) {

        console.error(
            "Email Service Error:",
            err
        );

        throw err;

    }

}