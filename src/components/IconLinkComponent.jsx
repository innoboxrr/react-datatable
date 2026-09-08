import DatatableIcon from './DatatableIcon.jsx'

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
            <DatatableIcon icon={icon} ratio={ratio} />
            <span className={textClass}>{text}</span>
        </a>
    )
}
