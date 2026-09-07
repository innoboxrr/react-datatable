/**
 * Gemelo de IconLinkComponent.vue.
 */
export default function IconLinkComponent({
    link = '#',
    text,
    icon,
    ratio = 1,
    textClass = '',
    target = '_self',
    onClick,
}) {
    return (
        <a
            className="block px-4 py-2 dark:hover:text-white dark:text-slate-400"
            href={link}
            target={target}
            onClick={onClick}>
            <span
                className="uk-margin-small-right uk-icon"
                uk-icon={`icon: ${icon}; ratio: ${ratio};`}
                style={{ fontSize: `${ratio * 16}px` }}></span>
            <span className={textClass}>{text}</span>
        </a>
    )
}
