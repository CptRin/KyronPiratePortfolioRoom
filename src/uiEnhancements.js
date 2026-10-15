import './uiEnhancements.scss';

export function createExternalLinkConfirmation({ onOpen, onClose, onClick, onReveal, onHide } = {}) {
    let activeDialog = null;
    function confirm(rawUrl, { target = '_blank' } = {}) {
        let destination;
        try { destination = new URL(rawUrl, window.location.href); }
        catch { return; }
        if (!['https:', 'http:'].includes(destination.protocol) || activeDialog) return;

        let closing = false;
        const previousFocus = document.activeElement;
        const dialog = document.createElement('dialog');
        activeDialog = dialog;
        dialog.className = 'external-link-dialog';
        dialog.setAttribute('aria-labelledby', 'external-link-title');
        dialog.setAttribute('aria-describedby', 'external-link-description');
        dialog.innerHTML = `
            <h2 id="external-link-title">Open external link?</h2>
            <p id="external-link-description"></p>
            <p class="external-link-destination"></p>
            <div class="external-link-actions">
                <button type="button" autofocus>No, stay here</button>
                <a class="external-link-confirm">Yes, open link</a>
            </div>
        `;
        dialog.querySelector('#external-link-description').textContent = target === '_blank'
            ? 'This link opens another website in a new tab. Would you like to continue?'
            : 'This link takes you to another website. Would you like to continue?';
        dialog.querySelector('.external-link-destination').textContent = destination.href;
        const yes = dialog.querySelector('.external-link-confirm');
        yes.href = destination.href;
        yes.target = target === '_blank' ? '_blank' : '_self';
        yes.rel = 'noopener noreferrer';
        function closeWithDissolve() {
            if (closing) return;
            closing = true;
            dialog.style.pointerEvents = 'none';
            if (onHide) onHide(dialog, () => dialog.close());
            else dialog.close();
        }
        dialog.addEventListener('cancel', event => {
            event.preventDefault();
            closeWithDissolve();
        });
        dialog.querySelector('button').addEventListener('click', () => {
            onClick?.();
            closeWithDissolve();
        });
        // Keep the native anchor navigation inside the user's click gesture.
        yes.addEventListener('click', event => {
            if (closing) { event.preventDefault(); return; }
            onClick?.();
            // Open the destination directly from this click; dissolve the
            // original tab's prompt without risking popup blocking.
            closeWithDissolve();
        });
        dialog.addEventListener('click', event => event.stopPropagation());
        dialog.addEventListener('close', () => {
            dialog.remove();
            activeDialog = null;
            onClose?.();
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
                previousFocus.focus({ preventScroll: true });
            }
        }, { once: true });
        document.body.append(dialog);
        dialog.showModal();
        onReveal?.(dialog);
        onOpen?.();
    }

    document.addEventListener('click', event => {
        const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (!anchor || anchor.closest('.external-link-dialog') || anchor.hasAttribute('download')) return;
        let destination;
        try { destination = new URL(anchor.href, window.location.href); }
        catch { return; }
        if (!['https:', 'http:'].includes(destination.protocol) ||
            destination.origin === window.location.origin) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        onClick?.();
        confirm(destination.href, {
            target: event.ctrlKey || event.metaKey || event.shiftKey ? '_blank' : anchor.target,
        });
    }, true);

    return { confirm };
}

export function setupAudioButtonFeedback() {
    const animations = new WeakMap();
    document.querySelectorAll(
        '#audio-menu-toggle-button, .audio-control-button, #audio-mute-control-button'
    ).forEach(button => {
        button.addEventListener('click', () => {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            animations.get(button)?.cancel();
            // Animate the individual scale property so hover rotation and
            // the menu's opening/closing transform continue to work normally.
            const animation = button.animate([
                { scale: '1', offset: 0 },
                { scale: '0.93', offset: 0.22 },
                { scale: '1.09', offset: 0.55 },
                { scale: '0.99', offset: 0.8 },
                { scale: '1', offset: 1 },
            ], { duration: 280, easing: 'ease-out' });
            animations.set(button, animation);
            animation.onfinish = () => animations.delete(button);
        });
    });
}
