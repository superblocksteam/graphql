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
    actionConfiguration
  }: PluginExecutionProps<GraphQLDatasourceConfiguration>): Promise<ExecutionOutput> {
    const query = actionConfiguration.body;

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

    const variables = actionConfiguration.custom?.variables?.value ?? '';
    if (_.isEmpty(variables)) {
      // Variables has to be an object in its deserialized form
      // for the graphql router to accept the query
      requestConfig.data.variables = {};
    } else {
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
