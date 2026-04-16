import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Script Idempotente de Configuração de Hierarquia
 * Garante que a estrutura master e o Super Admin existam independente do ambiente.
 */
export async function bootstrapDatabase(user: any, isMasterSession: boolean) {
  if (!user) return;

  const currentEmail = user.email?.toLowerCase().trim();
  const masterPassword = (firebaseConfig as any).masterPassword || "admin123";
  
  // Verifica se este usuário deve ser promovido a Super Admin
  const shouldBeSuper = isMasterSession;

  if (shouldBeSuper) {
    console.log('🚀 Iniciando Bootstrap de Super Admin para:', currentEmail);
    const errors: string[] = [];

    // 1. Garante o registro GLOBAL do usuário com cargo de autoridade
    try {
      const userGlobalRef = doc(db, 'users', user.uid);
      await setDoc(userGlobalRef, {
        uid: user.uid,
        email: currentEmail,
        role: 'super_admin',
        isSuperAdmin: true,
        orgId: 'master-org',
        bootstrapToken: masterPassword, // Token para as regras de segurança
        updatedAt: serverTimestamp()
      }, { merge: true });
      console.log('✅ Registro global de Super Admin criado/atualizado.');
    } catch (e: any) {
      console.error('❌ Erro no passo 1 do bootstrap:', e);
      errors.push(`Passo 1 (Global User): ${e.message}`);
    }

    // 2. Garante que a Organização Master exista
    const masterOrgId = 'master-org';
    try {
      const orgRef = doc(db, 'organizations', masterOrgId);
      const orgSnap = await getDoc(orgRef);
      
      if (!orgSnap.exists()) {
        await setDoc(orgRef, {
          id: masterOrgId,
          name: 'Master Administration',
          ownerUid: user.uid,
          status: 'active',
          createdAt: serverTimestamp(),
          isMaster: true
        });
        console.log('✅ Organização Master criada.');
      }
    } catch (e: any) {
      console.error('❌ Erro no passo 2 do bootstrap:', e);
      errors.push(`Passo 2 (Master Org): ${e.message}`);
    }

    // 3. Garante o vínculo do usuário dentro da Org Master
    try {
      const userInOrgRef = doc(db, 'organizations', masterOrgId, 'users', user.uid);
      await setDoc(userInOrgRef, {
        uid: user.uid,
        orgId: masterOrgId,
        email: currentEmail,
        displayName: user.displayName || 'Super Admin',
        role: 'admin',
        active: true,
        bootstrapToken: masterPassword,
        updatedAt: serverTimestamp()
      }, { merge: true });
      console.log('✅ Usuário vinculado à Org Master.');
    } catch (e: any) {
      console.error('❌ Erro no passo 3 do bootstrap:', e);
      errors.push(`Passo 3 (Org User): ${e.message}`);
    }

    // 4. Garante Configurações Iniciais da Master Org (Training)
    try {
      const trainingRef = doc(db, 'organizations', masterOrgId, 'settings', 'training');
      const trainingSnap = await getDoc(trainingRef);
      if (!trainingSnap.exists()) {
        await setDoc(trainingRef, {
          agentMd: "# Master Agent Configuration\nYou are the global administrator assistant.",
          shopMd: "# Master Services\nGlobal management and support.",
          updatedAt: serverTimestamp()
        });
        console.log('✅ Configurações de treinamento criadas.');
      }
    } catch (e: any) {
      console.error('❌ Erro no passo 4 do bootstrap:', e);
      errors.push(`Passo 4 (Training Settings): ${e.message}`);
    }

    // 5. Garante Boas-vindas Padrão
    try {
      const welcomeRef = doc(db, 'organizations', masterOrgId, 'settings', 'welcome');
      const welcomeSnap = await getDoc(welcomeRef);
      if (!welcomeSnap.exists()) {
        await setDoc(welcomeRef, {
          text: "Bem-vindo ao Sistema Master!",
          mediaType: "none",
          updatedAt: serverTimestamp()
        });
        console.log('✅ Mensagem de boas-vindas criada.');
      }
    } catch (e: any) {
      console.error('❌ Erro no passo 5 do bootstrap:', e);
      errors.push(`Passo 5 (Welcome Settings): ${e.message}`);
    }

    if (errors.length > 0) {
      throw new Error(`Ocorreram erros durante o bootstrap:\n${errors.join('\n')}`);
    }

    console.log('✅ Bootstrap concluído com sucesso.');
    return true;
  }

  return false;
}
