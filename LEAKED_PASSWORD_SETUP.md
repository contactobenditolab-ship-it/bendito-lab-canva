# 🔐 Habilitar Leaked Password Protection en Supabase

**Estado actual:** ❌ DESHABILITADO  
**Tiempo requerido:** 5 minutos  
**Acción:** Manual en dashboard (no programable via SQL/API)

---

## Instrucciones paso-a-paso

### 1️⃣ Acceder al Dashboard
```
URL: https://app.supabase.com/project/xzhmqevwjbvgfzerjmgx/settings/auth
```

Alternativamente:
1. Ve a: https://app.supabase.com
2. Selecciona proyecto: **xzhmqevwjbvgfzerjmgx** (bendito-os)
3. Izquierda → **Settings**
4. → **Authentication**

### 2️⃣ Buscar "Password Security"
En la página de Authentication, busca la sección:
- **"Password Security"** (nombre puede variar según versión de Supabase)
- O: **"Leaked Password Protection"**
- O: **"Check Against HaveIBeenPwned"**

### 3️⃣ Habilitar el toggle
- Busca el toggle/switch junto a "Leaked Password Protection"
- Estado actual: **🔴 OFF**
- Acción: Click para cambiar a **🟢 ON**

### 4️⃣ Confirmar cambio
- Si aparece modal de confirmación, acepta
- Espera a que se guarde (~2-3 segundos)
- Verás confirmación: "✅ Settings saved" o similar

### 5️⃣ ¡Listo!
La configuración está ahora activa.

---

## Qué hace esta feature

✅ **Cuando habilitada:**
- Supabase valida todas las contraseñas contra Have I Been Pwned database
- Si un usuario intenta usar una contraseña comprometida:
  - En `signup`: rechaza con error "Password has been previously compromised"
  - En `password change`: rechaza con error similar
- Supabase hace la verificación automáticamente (no necesita config adicional)
- Es completamente transparente para el usuario

---

## Verificación opcional: JWT Expiry

Mientras estés en Auth settings, verifica también:

### JWT Expiry
- Ubicación: Misma sección de Auth settings
- Campo: **"JWT Expiry"**
- Valor esperado: **3600** segundos (1 hora) ✓

Si es diferente (ej: 36000 = 10 horas):
1. Click en el campo
2. Cambia a: **3600**
3. Guardar

### Refresh Token Expiry
- Campo: **"Refresh Token Expiry"** o **"Refresh Token Max Duration"**
- Valor esperado: **604800** segundos (7 días) ✓

Si es diferente:
1. Click en el campo
2. Cambia a: **604800**
3. Guardar

---

## Verificación de que está funcionando

Después de habilitar, puedes probar:

1. Intenta registrarte con esta contraseña comprometida:
   ```
   password123  (común, seguramente en Have I Been Pwned)
   ```

2. Esperado:
   - ❌ Rechazo con mensaje: "Password has been previously compromised"
   - ✅ No puede crear cuenta

3. Intenta con una contraseña fuerte diferente:
   - ✅ Debe permitir registro

---

## Nota técnica

- Esta feature NO está disponible via SQL o API REST
- Solo se configura desde el dashboard
- La base de datos Have I Been Pwned se consulta via API segura (Supabase + HIBP)
- No impacta performance (el check es async en background)

