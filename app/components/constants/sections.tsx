import { Badge } from "../ui/badge"

export const sections = [
  { 
    id: 'home', 
    subtitle: <Badge variant="outline" className="text-white border-white">S1: Feb 15</Badge>,
    title: "Introducing PhishForge.",
    showButton: true,
    buttonText: 'Get Started'
  },
  { 
    id: 'features', 
    title: 'Why Us?', 
    content: 'We provide resources, mentorship, and a supportive network to help you grow your projects.' 
  },
  { 
    id: 'how-it-works', 
    title: 'How It Works', 
    content: 'Access to expert advice, networking opportunities, and cutting-edge tools to accelerate your growth.' 
  },
  { 
    id: 'meet-the-devs', 
    title: 'Success Stories', 
    content: 'Hear from solo builders who have transformed their side projects into thriving businesses.' 
  },
  { 
    id: 'join', 
    title: 'Get Started', 
    content: 'Ready to take your side project to the next level? Join our community today and start building your future.',
    showButton: true,
    buttonText: 'Join Now'
  },
]
