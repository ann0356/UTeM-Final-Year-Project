import { _supabase } from '../../SUPABASE/supabase_customer_conn.js';

window.addEventListener('DOMContentLoaded', () => {

    const loginBtn = document.getElementById('login-btn');
    const togglePasswordCheckbox = document.getElementById('toggle-password');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const forgotPwdLink = document.getElementById('forgot-password-link'); // 获取忘记密码按钮

    // 1. 显示/隐藏密码
    togglePasswordCheckbox.addEventListener('change', function() {
        passwordInput.type = this.checked ? 'text' : 'password';
    });

    // 🌟 2. 新增：监听回车键 (Enter) 自动提交登录
    const allInputs = document.querySelectorAll('input');
    allInputs.forEach(input => {
        input.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault(); 
                loginBtn.click(); // 模拟点击登录按钮
            }
        });
    });

    // 🌟 3. 新增：忘记密码功能逻辑
    if (forgotPwdLink) {
        forgotPwdLink.addEventListener('click', async (e) => {
            e.preventDefault(); // 阻止 <a> 标签默认的网页跳转
            
            const email = emailInput.value.trim();

            // 检查用户有没有输入邮箱
            if (!email) {
                alert("Please enter your email address in the box first to reset your password.");
                emailInput.focus(); // 自动把光标移到邮箱输入框
                return;
            }

            // 调用 Supabase 发送密码重置邮件
            alert("Sending reset email...");
            const { data, error } = await _supabase.auth.resetPasswordForEmail(email);
            redirectTo: 'http://127.0.0.1:5501'

            if (error) {
                alert("Failed to send reset email: " + error.message);
            } else {
                alert("Password reset email sent! Please check your inbox.");
            }

             redirectTo: 'http://127.0.0.1:5501/CUSTOMER/HTML/cus_reset_password.html'
        });
    }

    // 4. 登录功能核心逻辑
    loginBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            alert("Please enter both email and password.");
            return;
        }

        loginBtn.disabled = true;
        loginBtn.innerText = "Logging in...";

        const { data: authData, error: authError } = await _supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (authError) {
            alert("Login Failed: " + authError.message);
            loginBtn.disabled = false;
            loginBtn.innerText = "Login";
            return;
        }

        if (!authData || !authData.user) {
            alert("Login failed: Missing session data.");
            loginBtn.disabled = false;
            loginBtn.innerText = "Login";
            return;
        }

        const userId = authData.user.id;

        const { data: profileData, error: profileError } = await _supabase
            .from('profiles')
            .select('first_name')
            .eq('id', userId)
            .single();

        loginBtn.disabled = false;
        loginBtn.innerText = "Login";

        if (profileData) {
            alert(`Welcome back, ${profileData.first_name}!`);
        } else {
            alert("Login successful!");
            console.log("Could not fetch profile info:", profileError);
        }

        window.location.href = "../HTML/cus_index.html";
    });

});