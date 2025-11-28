import { useState } from 'react';
import { Button, type SelectOption } from '../atoms';
import { Modal, ModalFooter, FormField } from '../molecules';
import type { FoundrySystem } from '@/types';

export interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, systemId: string, description: string) => void;
  systems: FoundrySystem[];
  isSubmitting?: boolean;
  testId?: string;
}

export function CreateCampaignModal({
  isOpen,
  onClose,
  onSubmit,
  systems,
  isSubmitting,
  testId = 'create-campaign-modal',
}: CreateCampaignModalProps) {
  const [name, setName] = useState('');
  const [systemId, setSystemId] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{ name?: string; systemId?: string }>({});

  const systemOptions: SelectOption[] = [
    ...systems.map((s) => ({
      value: s.id,
      label: `${s.title}${s.version ? ` v${s.version}` : ''}`,
    })),
    { value: '__add_new__', label: '+ Add New System...' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: typeof errors = {};
    if (!name.trim()) {
      newErrors.name = 'Campaign name is required';
    }
    if (!systemId || systemId === '__add_new__') {
      newErrors.systemId = 'Please select a game system';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(name.trim(), systemId, description.trim());
  };

  const resetForm = () => {
    setName('');
    setSystemId('');
    setDescription('');
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Campaign" testId={testId}>
      <form onSubmit={handleSubmit} data-testid={`${testId}-form`}>
        <div className="space-y-4">
          <FormField
            label="Campaign Name"
            name="campaign-name"
            value={name}
            onChange={(v) => {
              setName(v);
              setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="e.g., Curse of Strahd"
            error={errors.name}
            required
            testId={`${testId}-name`}
          />

          <FormField
            label="Game System"
            name="campaign-system"
            type="select"
            value={systemId}
            onChange={(v) => {
              setSystemId(v);
              setErrors((prev) => ({ ...prev, systemId: undefined }));
            }}
            options={systemOptions}
            placeholder="-- Select a system --"
            error={errors.systemId}
            required
            testId={`${testId}-system`}
          />

          <FormField
            label="Description (Optional)"
            name="campaign-description"
            type="textarea"
            value={description}
            onChange={setDescription}
            placeholder="Brief description of your campaign..."
            testId={`${testId}-description`}
          />
        </div>

        <ModalFooter testId={`${testId}-footer`}>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
            testId={`${testId}-cancel-btn`}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            testId={`${testId}-submit-btn`}
          >
            Create Campaign
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
