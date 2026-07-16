import { Link } from 'react-router-dom';
import { BriefcaseBusiness, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function HumanResourcesSettingsPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BriefcaseBusiness className="h-4 w-4 text-primary" />
          RH
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link to="/rh">
            Abrir RH
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
