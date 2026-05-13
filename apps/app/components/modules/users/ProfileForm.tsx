'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Link } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useUpdateProfile } from '@/lib/hooks/users/useUpdateProfile';
import type { OrgUser } from '@/types';

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(255),
  avatarUrl: z
    .string()
    .url('URL inválida')
    .max(500)
    .optional()
    .or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

interface ProfileFormProps {
  user: OrgUser;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const updateProfile = useUpdateProfile();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user.name,
      avatarUrl: user.avatarUrl ?? '',
    },
  });

  useEffect(() => {
    reset({ name: user.name, avatarUrl: user.avatarUrl ?? '' });
  }, [user, reset]);

  const previewAvatar = watch('avatarUrl');

  async function onSubmit(data: FormData) {
    await updateProfile.mutateAsync({
      name: data.name,
      avatarUrl: data.avatarUrl || undefined,
    });
    reset(data);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div className="flex items-center gap-4 pb-1">
        <Avatar
          name={user.name}
          src={previewAvatar || user.avatarUrl || undefined}
          size="xl"
        />
        <div>
          <p className="text-sm font-medium text-text-primary">{user.name}</p>
          <p className="text-xs text-text-muted">{user.email}</p>
          <div className="mt-1.5">
            <Badge variant={user.role === 'admin' ? 'amber' : 'default'}>
              {user.role === 'admin' ? 'Admin' : 'Membro'}
            </Badge>
          </div>
        </div>
      </div>

      <Input
        label="Nome"
        placeholder="Seu nome"
        iconLeft={<User size={15} />}
        error={errors.name?.message}
        {...register('name')}
      />

      <Input
        label="URL do avatar"
        placeholder="https://exemplo.com/avatar.png"
        iconLeft={<Link size={15} />}
        helper="Cole a URL de uma imagem. Upload direto disponível em breve."
        error={errors.avatarUrl?.message}
        {...register('avatarUrl')}
      />

      <div className="pt-2 flex justify-end">
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={isSubmitting || updateProfile.isPending}
          disabled={!isDirty}
        >
          Salvar perfil
        </Button>
      </div>
    </form>
  );
}
