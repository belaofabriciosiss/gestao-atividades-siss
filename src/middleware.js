import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  // Retornar imediatamente se as variáveis de ambiente não estão configuradas
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Supabase env vars missing')
    return NextResponse.next()
  }

  try {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              request.cookies.set(name, value, options)
            )
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    const { pathname } = request.nextUrl

    // Se não logado e tentando acessar rota protegida
    if (!user && pathname !== '/login') {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Se logado e tentando acessar login, redireciona para atividades
    if (user && pathname === '/login') {
      return NextResponse.redirect(new URL('/atividades', request.url))
    }

    // Verificar acesso a rotas exclusivas do gestor
    if (user && ['/planejamento', '/locais', '/responsaveis'].some(p => pathname.startsWith(p))) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('papel')
          .eq('id', user.id)
          .single()

        if (!profile || profile.papel !== 'gestor') {
          return NextResponse.redirect(new URL('/atividades', request.url))
        }
      } catch {
        // Se a tabela profiles não existe ainda, redireciona para atividades
        return NextResponse.redirect(new URL('/atividades', request.url))
      }
    }

    return supabaseResponse
  } catch (error) {
    // Em caso de qualquer erro no middleware, deixa a requisição prosseguir
    // para evitar o MIDDLEWARE_INVOCATION_FAILED
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
