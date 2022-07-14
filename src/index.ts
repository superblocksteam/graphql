import {
  DatasourceMetadataDto,
  ExecutionOutput,
  GraphQLActionConfiguration,
  GraphQLDatasourceConfiguration,
  HttpMethod,
  makeCurlString,
  RawRequest
} from '@superblocksteam/shared';
import { ApiPlugin, PluginExecutionProps } from '@superblocksteam/shared-backend';
import _, { isString } from 'lodash';

export interface RequestConfig {
  query: string;
  variables?: unknown;
  operationName?: string;
}

export default class GraphQLPlugin extends ApiPlugin {
  async execute({
    context,
    datasourceConfiguration,
    actionConfiguration,
    forwardedCookies
  }: PluginExecutionProps<GraphQLDatasourceConfiguration>): Promise<ExecutionOutput> {
    const query = actionConfiguration.body;
    const url = new URL(actionConfiguration.path);
    const host = url.hostname;
    // replace everything up to the last dot in the hostname to get domain
    const domain = host.replace(/^[^.]+\./g, '');
    const cookies = Object.entries(forwardedCookies ?? {})
      .filter(([k, v]) => v.domain === domain)
      .map(([k, v]) => `${k}=${v.value}`);

    if (cookies.length) {
      // append to existing cookies if exists
      const cookieObj = actionConfiguration.headers.find((o) => o.key === 'Cookie');
      actionConfiguration.headers = [
        ...actionConfiguration.headers.filter((o) => o.key !== 'Cookie'),
        {
          key: 'Cookie',
          value: cookies.join('; ') + (cookieObj ? `;${cookieObj.value}` : '')
        }
      ];
    }

    let requestConfig = this.generateRequestConfig(actionConfiguration);
    // Always use POST for GraphQL since GET has limits on URL length
    requestConfig.method = HttpMethod.POST;
    requestConfig = { ...requestConfig, ...this.postRequestConfig(query, actionConfiguration) };

    return await this.executeRequest(requestConfig);
  }

  getRequest(actionConfiguration: GraphQLActionConfiguration): RawRequest {
    const bodyConfig = this.postRequestConfig(actionConfiguration.body, actionConfiguration).data;
    const body = isString(bodyConfig) ? bodyConfig : JSON.stringify(bodyConfig);
    return makeCurlString({
      reqMethod: HttpMethod.POST,
      reqUrl: actionConfiguration.path,
      reqHeaders: actionConfiguration.headers,
      reqBody: body
    });
  }

  private postRequestConfig(query: string, actionConfiguration: GraphQLActionConfiguration): { data: string | RequestConfig } {
    const requestConfig: { data: RequestConfig } = {
      data: {
        query
      }
    };

    const variables = actionConfiguration.custom?.variables?.value;
    // Checking for the nil case, as well as an empty string
    // as variables is persisted as an empty string when the field
    // is cleared out by a user in the UI
    if (!(_.isNil(variables) || variables === '')) {
      requestConfig.data.variables = JSON.parse(variables);
    }

    return requestConfig;
  }

  dynamicProperties(): string[] {
    return ['path', 'body', 'custom.variables.value', 'headers'];
  }

  escapeStringProperties(): string[] {
    return ['body'];
  }

  async metadata(datasourceConfiguration: GraphQLDatasourceConfiguration): Promise<DatasourceMetadataDto> {
    return {};
  }

  async test(datasourceConfiguration: GraphQLDatasourceConfiguration): Promise<void> {
    return;
  }
}
