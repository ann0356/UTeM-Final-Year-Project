import { _supabase } from '../../SUPABASE/supabase_customer_conn.js'; 

document.addEventListener('DOMContentLoaded', async () => {
    const requestSection = document.getElementById('request-section');
    const updateSection = document.getElementById('update-section');
    const requestForm = document.getElementById('request-form');
    const updateForm = document.getElementById('update-form');
    
    // 控制旧密码显示状态的变量
    let isPasswordRecoveryMode = false;
    let currentUserEmail = null; // 用于验证旧密码时需要

    // ==========================================
    // 🧠 1. 智能状态检测
    // ==========================================
    async function checkState() {
        const { data: { session } } = await _supabase.auth.getSession();
        
        // 检查是不是从邮箱点 "Reset Password" 链接过来的
        const hash = window.location.hash;
        if (hash && hash.includes('type=recovery')) {
            isPasswordRecoveryMode = true;
        }

        if (session) {
            currentUserEmail = session.user.email;
            requestSection.style.display = 'none';
            updateSection.style.display = 'block';

            // 🌟 核心逻辑：如果是忘记密码流程进来的，隐藏旧密码框
            if (isPasswordRecoveryMode) {
                document.getElementById('old-password-group').style.display = 'none';
                document.getElementById('upd-old-password').removeAttribute('required');
                document.getElementById('update-title').innerText = "Reset Password";
                document.getElementById('update-desc').innerText = "Please set your new password.";
            } else {
                // 如果是登录状态下主动点 "修改密码" 过来的，必须强制输入旧密码
                document.getElementById('old-password-group').style.display = 'block';
                document.getElementById('upd-old-password').setAttribute('required', 'true');
                document.getElementById('update-title').innerText = "Change Password";
                document.getElementById('update-desc').innerText = "Please enter your current password to verify your identity.";
            }
        } else {
            // 没登录且没有带着恢复链接，显示让你输邮箱的界面
            requestSection.style.display = 'block';
            updateSection.style.display = 'none';
        }
    }

    _supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            isPasswordRecoveryMode = true;
            checkState();
        }
    });

    await checkState();

    // ==========================================
    // 📩 2. 处理发送邮件请求 (Forgot Password)
    // ==========================================
    if (requestForm) {
        requestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-send');
            const email = document.getElementById('req-email').value;

            btn.innerText = 'Sending...';
            btn.disabled = true;

            try {
                const { error } = await _supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.href 
                });
                if (error) throw error;
                alert("A password reset link has been sent to your email. Please check your inbox (and spam folder).");
            } catch (error) {
                console.error("Reset Error:", error);
                alert("Error: " + error.message);
            } finally {
                btn.innerText = 'Send Reset Link';
                btn.disabled = false;
            }
        });
    }

    // ==========================================
    // 🔐 3. 处理更新密码请求 (Update Password)
    // ==========================================
    if (updateForm) {
        updateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-update');
            const oldPassword = document.getElementById('upd-old-password').value;
            const newPassword = document.getElementById('upd-password').value;
            const confirmPassword = document.getElementById('upd-confirm').value;

            // 基础校验
            if (newPassword !== confirmPassword) {
                return alert("Passwords do not match! Please try again.");
            }
            if (newPassword.length < 8) {
                return alert("Password length cannot be less than 8!");
            }
            const passwordSpecialCharRegex = /[+@_%!\-]/; 
            if (!passwordSpecialCharRegex.test(newPassword)) {
                return alert("Password should include special symbols! (+@_%!-)");
            }

            btn.innerText = 'Verifying & Updating...';
            btn.disabled = true;

            try {
                // 🌟 核心防线：如果不是“忘记密码”模式，就必须先验证旧密码！
                if (!isPasswordRecoveryMode) {
                    if (!oldPassword) throw new Error("Current password is required.");
                    
                    // 利用 Supabase 的 signIn 机制来静默验证旧密码是否正确
                    const { error: verifyError } = await _supabase.auth.signInWithPassword({
                        email: currentUserEmail,
                        password: oldPassword,
                    });

                    if (verifyError) {
                        throw new Error("Incorrect current password! Please try again.");
                    }
                }

                // 旧密码验证通过 (或是走的邮箱重置通道)，正式更新密码
                const { error: updateError } = await _supabase.auth.updateUser({
                    password: newPassword
                });

                if (updateError) throw updateError;

                alert("Success! Your password has been updated. Please log in again.");
                await _supabase.auth.signOut();
                window.location.href = 'cus_login.html'; 

            } catch (error) {
                console.error("Update Error:", error);
                alert(error.message);
            } finally {
                btn.innerText = 'Update Password';
                btn.disabled = false;
            }
        });
    }

    // ==========================================
    // 🛑 4. 拦截取消操作
    // ==========================================
    const cancelBtn = document.getElementById('cancel-reset');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', async (e) => {
            e.preventDefault(); 
            const urlParams = new URLSearchParams(window.location.search);
            const isFromProfile = urlParams.get('from') === 'profile';

            if (isFromProfile && !isPasswordRecoveryMode) {
                window.location.href = 'cus_index.html?page=profile';
            } else {
                await _supabase.auth.signOut(); 
                window.location.href = 'cus_index.html';
            }
        });
    }

    // ==========================================
    // 👁️ 5. 密码小眼睛功能绑定
    // ==========================================
    function setupPasswordToggle(inputId, iconId) {
        const inputField = document.getElementById(inputId);
        const toggleIcon = document.getElementById(iconId);

        if (inputField && toggleIcon) {
            toggleIcon.addEventListener('click', () => {
                const type = inputField.type === 'password' ? 'text' : 'password';
                inputField.type = type;

                if (type === 'text') {
                    toggleIcon.classList.remove('fa-eye-slash');
                    toggleIcon.classList.add('fa-eye');
                } else {
                    toggleIcon.classList.remove('fa-eye');
                    toggleIcon.classList.add('fa-eye-slash');
                }
            });
        }
    }

    // 绑定所有的密码框
    setupPasswordToggle('upd-old-password', 'toggle-old-pwd');
    setupPasswordToggle('upd-password', 'toggle-pwd');
    setupPasswordToggle('upd-confirm', 'toggle-confirm');
});