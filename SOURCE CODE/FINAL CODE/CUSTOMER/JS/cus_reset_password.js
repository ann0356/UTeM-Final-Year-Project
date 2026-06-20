import { _supabase } from '../../SUPABASE/supabase_customer_conn.js'; // 修正为正确的双层回退路径

document.addEventListener('DOMContentLoaded', async () => {
    const requestSection = document.getElementById('request-section');
    const updateSection = document.getElementById('update-section');
    const requestForm = document.getElementById('request-form');
    const updateForm = document.getElementById('update-form');

    // ==========================================
    // 🧠 1. 智能状态检测：决定显示哪个界面
    // ==========================================
    async function checkState() {
        const { data: { session }, error } = await _supabase.auth.getSession();
        
        // 如果有 session (意味着用户已登录，或者刚刚通过邮件里的安全链接跳转过来)
        if (session) {
            requestSection.style.display = 'none';
            updateSection.style.display = 'block';
        } else {
            // 没有登录，显示输入邮箱的界面
            requestSection.style.display = 'block';
            updateSection.style.display = 'none';
        }
    }

    // 监听 Supabase 的特殊事件 (捕捉从邮件链接跳回来的瞬间)
    _supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            requestSection.style.display = 'none';
            updateSection.style.display = 'block';
        }
    });

    // 页面加载时执行检查
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
                // redirectTo 的作用是让用户在邮箱里点击链接后，跳回当前的这个重置页面
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
            const newPassword = document.getElementById('upd-password').value;
            const confirmPassword = document.getElementById('upd-confirm').value;

            // 🌟 校验 1: 检查两次密码是否一致
            if (newPassword !== confirmPassword) {
                alert("Passwords do not match! Please try again.");
                return;
            }

            // 🌟 校验 2: 检查密码长度 
            if (newPassword.length < 8) {
                alert("Password length cannot less than 8!");
                return;
            }

            // 🌟 校验 3: 检查特殊符号 
            const passwordSpecialCharRegex = /[+@_%!\-]/; 
            if (!passwordSpecialCharRegex.test(newPassword)) {
                alert("Password should include special symbols! (+@_%!-)");
                return;
            }

            btn.innerText = 'Updating...';
            btn.disabled = true;

            try {
                // 提交新密码到 Supabase
                const { error } = await _supabase.auth.updateUser({
                    password: newPassword
                });

                if (error) throw error;

                // 🌟 更新成功后，强制登出并引导至登录页重新登录
                alert("Success! Your password has been updated. Please log in with your new password.");
                await _supabase.auth.signOut();
                window.location.href = 'cus_login.html'; 

            } catch (error) {
                console.error("Update Error:", error);
                alert("Failed to update password: " + error.message);
            } finally {
                btn.innerText = 'Update Password';
                btn.disabled = false;
            }
        });
    }

    // ==========================================
    // 🛑 4. 拦截取消操作 (智能判断是否强行登出)
    // ==========================================
    const cancelBtn = document.getElementById('cancel-reset');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', async (e) => {
            e.preventDefault(); 
            
            // 检查网址里有没有我们埋下的 "from=profile" 记号
            const urlParams = new URLSearchParams(window.location.search);
            const isFromProfile = urlParams.get('from') === 'profile';

            if (isFromProfile) {
                // 场景 A：从个人中心正常过来的已登录用户。直接退回 Profile，不登出！
                window.location.href = 'cus_index.html?page=profile';
            } else {
                // 场景 B：从忘记密码的邮件链接过来的。属于临时会话，必须登出销毁！
                await _supabase.auth.signOut(); 
                window.location.href = 'cus_index.html';
            }
        });
    }
});