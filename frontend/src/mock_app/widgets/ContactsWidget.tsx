
import { MessageSquare } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';

const contacts = [
    { name: 'Jane Doe', role: 'EQUITY' },
    { name: 'John Smith', role: 'FX/FI' },
    { name: 'Sarah Wilson', role: 'DERIVATIVES' },
    { name: 'Michael Brown', role: 'COMMODITIES' }
];

const ContactsWidget = () => {
    const { selectContact } = useSimulationStore();

    return (
        <div className="h-full overflow-auto custom-scrollbar bg-[var(--bg-primary)]">
            <div className="flex flex-col border-collapse text-xs">
                {contacts.map((contact, index) => (
                    <div
                        key={index}
                        onClick={() => selectContact(contact.name)}
                        className="flex items-center justify-between p-3 border-b border-[var(--border-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors group"
                    >
                        <div className="flex flex-col">
                            <span className="text-[var(--text-primary)] font-semibold group-hover:text-[var(--accent-color)] transition-colors">
                                {contact.name}
                            </span>
                            <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mt-0.5">
                                {contact.role}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 px-2 py-1 bg-[var(--bg-tertiary)] rounded text-[var(--accent-color)] group-hover:bg-[var(--accent-color)] group-hover:text-white transition-all uppercase font-bold text-[9px]">
                            <MessageSquare size={12} />
                            CHAT
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ContactsWidget;
