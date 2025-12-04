import { useState } from 'react';
import './BriefMethodSelector.css';

/**
 * Component for selecting brief submission method
 * Presents three options: Original Brief, PDF + Images, Structured Form
 */
function BriefMethodSelector({ onMethodSelect, currentMethod }) {
    const [hoveredMethod, setHoveredMethod] = useState(null);

    const methods = [
        {
            id: 'document',
            icon: '📄',
            title: 'Original Brief',
            subtitle: 'PDF or DOCX',
            description: 'Upload complete document with specifications',
            features: [
                'Fast if you have existing brief',
                'DOCX auto-extracts images',
                'Familiar workflow'
            ],
            limitations: [
                'AI parsing may have errors (~5-10%)',
                'Less control over formatting'
            ],
            bestFor: 'Teams with existing brief templates'
        },
        {
            id: 'pdf-images',
            icon: '📋',
            title: 'PDF + Images',
            subtitle: 'Separate uploads',
            description: 'Upload PDF brief + separate high-res images',
            features: [
                'Control over image quality',
                'Auto-matching by filename',
                'Manual reordering option'
            ],
            limitations: [
                'Still relies on AI parsing',
                'Two-step upload process'
            ],
            bestFor: 'High-resolution image requirements'
        },
        {
            id: 'form',
            icon: '✨',
            title: 'Structured Form',
            subtitle: 'Guided input',
            description: 'Fill out form with validation',
            features: [
                '100% accurate - no AI errors',
                'Real-time validation',
                'Full control per image',
                'Bulk operations'
            ],
            limitations: [
                'Takes more time to fill',
                'Best for <20 images'
            ],
            bestFor: 'New projects, critical campaigns',
            recommended: true
        }
    ];

    return (
        <div className="brief-method-selector">
            <div className="selector-header">
                <h2>Choose Your Submission Method</h2>
                <p>Select how you'd like to provide your image specifications</p>
            </div>

            <div className="method-cards">
                {methods.map(method => (
                    <div
                        key={method.id}
                        className={`method-card ${currentMethod === method.id ? 'selected' : ''} ${method.recommended ? 'recommended' : ''}`}
                        onClick={() => onMethodSelect(method.id)}
                        onMouseEnter={() => setHoveredMethod(method.id)}
                        onMouseLeave={() => setHoveredMethod(null)}
                    >
                        {method.recommended && (
                            <div className="recommended-badge">
                                <span className="star">⭐</span> RECOMMENDED
                            </div>
                        )}

                        <div className="card-icon">{method.icon}</div>

                        <h3>{method.title}</h3>
                        <p className="subtitle">{method.subtitle}</p>
                        <p className="description">{method.description}</p>

                        {(hoveredMethod === method.id || currentMethod === method.id) && (
                            <div className="card-details">
                                <div className="features">
                                    <h4>✓ Features</h4>
                                    <ul>
                                        {method.features.map((feature, idx) => (
                                            <li key={idx}>{feature}</li>
                                        ))}
                                    </ul>
                                </div>

                                {method.limitations.length > 0 && (
                                    <div className="limitations">
                                        <h4>⚠️ Considerations</h4>
                                        <ul>
                                            {method.limitations.map((limitation, idx) => (
                                                <li key={idx}>{limitation}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="best-for">
                                    <strong>Best for:</strong> {method.bestFor}
                                </div>
                            </div>
                        )}

                        <button className="select-button">
                            {currentMethod === method.id ? 'Selected ✓' : 'Select'}
                        </button>
                    </div>
                ))}
            </div>

            <div className="selector-footer">
                <p className="hint">
                    💡 <strong>Not sure which to choose?</strong> The Structured Form is recommended for most users as it guarantees 100% accuracy.
                </p>
            </div>
        </div>
    );
}

export default BriefMethodSelector;
