export function initHome(loadContentFunction) {
    console.log("Initializing Home Page...");

    // ==========================================
    // 1. 解决面板跳转问题
    // ==========================================
    document.querySelectorAll('.cus-nav-link').forEach(panel => {
        panel.addEventListener('click', () => {
            const pageName = panel.getAttribute('data-page');
            console.log("Navigating to:", pageName);
            
            // 调用传进来的主路由函数进行页面切换
            if (typeof loadContentFunction === 'function') {
                loadContentFunction(pageName);
            } else {
                console.error("loadContentFunction is not provided!");
            }
        });
    });

    // ==========================================
    // 2. 手动轮播图逻辑
    // ==========================================
    const slides = document.querySelectorAll('.banner-slide');
    const dots = document.querySelectorAll('.dot');
    const prevBtn = document.getElementById('banner-prev');
    const nextBtn = document.getElementById('banner-next');
    
    if (slides.length === 0) return;

    let currentSlide = 0;

    // 核心切换函数
    function goToSlide(index) {
        // 移除旧状态
        slides[currentSlide].classList.remove('active');
        dots[currentSlide].classList.remove('active');
        
        // 更新当前索引 (防止超出边界)
        currentSlide = (index + slides.length) % slides.length;
        
        // 添加新状态
        slides[currentSlide].classList.add('active');
        dots[currentSlide].classList.add('active');
    }

    // 绑定左右按钮
    if (prevBtn) prevBtn.addEventListener('click', () => goToSlide(currentSlide - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => goToSlide(currentSlide + 1));

    // 绑定下方的小圆点点击事件
    dots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            goToSlide(index);
        });
    });
}