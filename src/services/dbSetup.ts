import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, adminEmail } from '../firebase';

/**
 * Script Idempotente de Configuração de Hierarquia
 * Garante que a estrutura master e o Super Admin existam independente do ambiente.
 */
export async function bootstrapDatabase(user: any, isMasterSession: boolean) {
  if (!user) return;

  const currentEmail = user.email?.toLowerCase().trim();
  const primaryAdminEmail = adminEmail.toLowerCase().trim();
  
  // Verifica se este usuário deve ser promovido a Super Admin
  const shouldBeSuper = currentEmail === primaryAdminEmail || isMasterSession;

  if (shouldBeSuper) {
    console.log('🚀 Iniciando Bootstrap de Super Admin para:', currentEmail);

    // 1. Garante o registro GLOBAL do usuário com cargo de autoridade
    const userGlobalRef = doc(db, 'users', user.uid);
    await setDoc(userGlobalRef, {
      uid: user.uid,
      email: currentEmail,
      role: 'super_admin', // Cargo mestre que as regras vão checar
      isSuperAdmin: true,
      orgId: 'master-org', // Vínculo essencial para as regras de segurança
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 2. Garante que a Organização Master exista
    const masterOrgId = 'master-org';
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
    }

    // 3. Garante o vínculo do usuário dentro da Org Master
    const userInOrgRef = doc(db, 'organizations', masterOrgId, 'users', user.uid);
    await setDoc(userInOrgRef, {
      uid: user.uid,
      orgId: masterOrgId,
      email: currentEmail,
      displayName: user.displayName || 'Super Admin',
      role: 'admin',
      active: true,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 4. Garante Configurações Iniciais da Master Org (Training)
    const trainingRef = doc(db, 'organizations', masterOrgId, 'settings', 'training');
    const trainingSnap = await getDoc(trainingRef);
    if (!trainingSnap.exists()) {
      await setDoc(trainingRef, {
        agentMd: "# Master Agent Configuration\nYou are the global administrator assistant.",
        shopMd: "# Master Services\nGlobal management and support.",
        updatedAt: serverTimestamp()
      });
    }

    // 5. Garante Boas-vindas Padrão
    const welcomeRef = doc(db, 'organizations', masterOrgId, 'settings', 'welcome');
    const welcomeSnap = await getDoc(welcomeRef);
    if (!welcomeSnap.exists()) {
      await setDoc(welcomeRef, {
        text: "Bem-vindo ao Sistema Master!",
        mediaType: "none",
        updatedAt: serverTimestamp()
      });
    }

    console.log('✅ Bootstrap concluído com sucesso.');
    return true;
  }

  return false;
}
